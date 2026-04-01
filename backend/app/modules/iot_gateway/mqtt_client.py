from __future__ import annotations

import logging
import time
from datetime import datetime

import paho.mqtt.client as mqtt

from app.settings import settings

logger = logging.getLogger(__name__)


class MqttSensorProvider:
    """Real MQTT sensor reader using paho-mqtt."""

    def __init__(
        self,
        broker_host: str = settings.mqtt_broker_host,
        broker_port: int = settings.mqtt_broker_port,
        topic: str = settings.mqtt_sensor_topic,
    ) -> None:
        self._broker_host = broker_host
        self._broker_port = broker_port
        self._topic = topic
        self._client: mqtt.Client | None = None
        self._latest_moisture: float = 45.0
        self._moisture_history: list[dict] = []
        self._received_mqtt_payload: bool = False

    def _on_message(self, client: mqtt.Client, userdata: object, msg: mqtt.MQTTMessage) -> None:
        try:
            self._latest_moisture = float(msg.payload.decode())
            self._received_mqtt_payload = True
            current_time = datetime.now().strftime("%H:%M:%S")
            self._moisture_history.append({"time": current_time, "value": self._latest_moisture})
            if len(self._moisture_history) > 15:
                self._moisture_history.pop(0)

            logger.info("MQTT moisture reading: %.1f%%", self._latest_moisture)
        except (ValueError, UnicodeDecodeError):
            logger.warning("Could not parse MQTT payload: %s", msg.payload)

    def _on_connect(
        self,
        client: mqtt.Client,
        userdata: object,
        flags,
        reason_code,
        properties,
    ) -> None:
        if reason_code.is_failure:
            logger.warning("MQTT CONNACK failure for sensor client: %s", reason_code)
            return
        client.subscribe(self._topic)
        logger.info(
            "MQTT sensor subscribed to %r on %s:%d",
            self._topic,
            self._broker_host,
            self._broker_port,
        )

    def connect(self) -> None:
        if self._client is not None:
            return
        self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        self._client.on_connect = self._on_connect
        self._client.on_message = self._on_message
        try:
            self._client.connect(self._broker_host, self._broker_port, 60)
            self._client.loop_start()
        except Exception as exc:
            logger.warning(
                "MQTT broker unavailable (%s:%d topic %r) – using fallback moisture: %s",
                self._broker_host,
                self._broker_port,
                self._topic,
                exc,
            )
            self._client = None

    def _reading_payload(self, *, waited_for_message: bool) -> dict:
        return {
            "moisture_percent": self._latest_moisture,
            "status": "low" if self._latest_moisture < 60 else "adequate",
            "history": self._moisture_history,
            "mqtt_connected": self._client is not None,
            "live": self._received_mqtt_payload,
            "topic": self._topic,
            "waited_for_message": waited_for_message,
        }

    def get_latest_reading_sync(self, device_id: str | None = None) -> dict:
        self.connect()
        if self._client is None:
            return self._reading_payload(waited_for_message=False)

        # Wait until the first payload (Wokwi publishes every 3s; allow extra slack for TCP + SUBACK).
        for _ in range(80):
            if self._received_mqtt_payload:
                break
            time.sleep(0.1)
        return self._reading_payload(waited_for_message=True)

    def get_cached_reading(self) -> dict:
        self.connect()
        return self._reading_payload(waited_for_message=False)

    async def get_latest_reading(self, device_id: str) -> dict:
        return self.get_latest_reading_sync(device_id)

    def disconnect(self) -> None:
        if self._client:
            self._client.loop_stop()
            self._client.disconnect()
            self._client = None


class MqttCommandPublisher:
    """Publishes irrigation commands over MQTT."""

    def __init__(
        self,
        broker_host: str = settings.mqtt_broker_host,
        broker_port: int = settings.mqtt_broker_port,
    ) -> None:
        self._broker_host = broker_host
        self._broker_port = broker_port
        self._client: mqtt.Client | None = None

    def connect(self) -> None:
        if self._client is not None:
            return
        self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        try:
            self._client.connect(self._broker_host, self._broker_port, 60)
            logger.info("MQTT command publisher connected")
        except Exception:
            logger.warning("MQTT command publisher: broker unavailable")
            self._client = None

    def publish_command_sync(self, topic: str, message: dict) -> bool:
        self.connect()
        if self._client:
            self._client.publish(topic, str(message))
            return True
        return False

    async def publish_command(self, device_id: str, command: dict) -> bool:
        return self.publish_command_sync(settings.mqtt_command_topic, command)
