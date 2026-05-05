#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* ssid = "Wokwi-GUEST";
const char* password = "";
const char* mqtt_server = "broker.hivemq.com";

WiFiClient espClient;
PubSubClient client(espClient);

int soilPin = 34;
int relayPin = 2;

void callback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.println("Received: " + message);

  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, message);

  if (!error) {
    const char* action = doc["action"];
    if (action && strcmp(action, "ON") == 0) {
      digitalWrite(relayPin, HIGH);
      Serial.println("Pump ON");
    } else {
      digitalWrite(relayPin, LOW);
      Serial.println("Pump OFF");
    }
  } else {
    // Fallback for plain string
    if (message.indexOf("ON") >= 0) {
      digitalWrite(relayPin, HIGH);
      Serial.println("Pump ON");
    } else {
      digitalWrite(relayPin, LOW);
      Serial.println("Pump OFF");
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(relayPin, OUTPUT);
  digitalWrite(relayPin, LOW);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");

  client.setServer(mqtt_server, 1883);
  client.setCallback(callback);
}

void reconnect() {
  int retries = 0;
  while (!client.connected() && retries < 3) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect("Agrio_ESP32_994827X")) {
      Serial.println("connected");
      client.subscribe("farm/irrigation_command");
      break;
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" retrying in 5 seconds");
      retries++;
      delay(5000);
    }
  }
  if (!client.connected()) {
    Serial.println("MQTT connection abandoned, continuing without it");
  }
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  static int simulatedMoisture = 20;
  static int direction = 1;

  simulatedMoisture += direction * 5;
  if (simulatedMoisture >= 80) direction = -1;
  if (simulatedMoisture <= 20) direction = 1;

  Serial.println(simulatedMoisture);

  char msg[50];
  snprintf(msg, 50, "%d", simulatedMoisture);
  client.publish("farm/soil_moisture", msg);

  delay(3000);
}