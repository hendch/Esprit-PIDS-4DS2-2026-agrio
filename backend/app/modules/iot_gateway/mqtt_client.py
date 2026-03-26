from __future__ import annotations

import logging
import time

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

    def _on_message(self, client: mqtt.Client, userdata: object, msg: mqtt.MQTTMessage) -> None:
        try:
            self._latest_moisture = float(msg.payload.decode())
            logger.info("MQTT moisture reading: %.1f%%", self._latest_moisture)
        except (ValueError, UnicodeDecodeError):
            logger.warning("Could not parse MQTT payload: %s", msg.payload)

    def connect(self) -> None:
        if self._client is not None:
            return
        self._client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        self._client.on_message = self._on_message
        try:
            self._client.connect(self._broker_host, self._broker_port, 60)
            self._client.subscribe(self._topic)
            self._client.loop_start()
            logger.info("MQTT connected to %s:%d", self._broker_host, self._broker_port)
        except Exception:
            logger.warning("MQTT broker unavailable – using fallback moisture value")
            self._client = None

    def get_latest_reading_sync(self, device_id: str | None = None) -> dict:
        self.connect()
        time.sleep(0.5)
        return {
            "moisture_percent": self._latest_moisture,
            "status": "low" if self._latest_moisture < 60 else "adequate",
        }

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
