const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const PushNotifications = require("node-pushnotifications");
const cors = require("cors");

//Importar rota de teste
const { coordenadas } = require('./rota');

require("dotenv").config(); // Carrega as variáveis de ambiente do arquivo .env

const app = express();

// Configuração de CORS para permitir todas as origens
app.use(cors());

app.use(express.static(path.join(__dirname, "client")));
app.use(bodyParser.json());

const publicVapidKey = "BGzhoR-UB7WPENnX8GsiKD90O8hLL7j8EPNL3ERqEiUUw1go74KBLCbiInuD_oamyCI5AjtScd2h8fqifk9fpjA"; // REPLACE_WITH_YOUR_KEY
const privateVapidKey = process.env.PRIVATE_VAPID_KEY;
const email = process.env.EMAIL;

const settings = {
  web: {
    vapidDetails: {
      subject: `mailto:${email}`,
      publicKey: publicVapidKey,
      privateKey: privateVapidKey,
    },
    gcmAPIKey: "gcmkey",
    TTL: 2419200,
    contentEncoding: "aes128gcm",
    headers: {},
  },
  isAlwaysUseFCM: false,
};

const push = new PushNotifications(settings);

let subscriptions = [];

app.post("/subscribe", (req, res) => {
  try {
    const subscription = req.body;

    // Verifique se a subscription é válida
    if (!subscription || !subscription.endpoint) {
      throw new Error("Objeto de assinatura inválido");
    }

    subscriptions.push(subscription);

    res.status(201).json({});
  } catch (err) {
    console.error("Falha ao assinar:", err);
    res.status(500).json({ error: "Falha ao assinar" });
  }
});

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html");
});
app.get("/main.js", (req, res) => {
  res.sendFile(__dirname + "/main.js");
});
app.get("/sw.js", (req, res) => {
  res.sendFile(__dirname + "/sw.js");
});

const port = process.env.PORT || 3000;

app.listen(port, () => console.log(`Servidor iniciado na porta ${port}`));

// Função para enviar notificações para todas as assinaturas
const sendNotification = (title) => {
  const payload = { title };
  subscriptions.forEach(subscription => {
    push.send(subscription, payload, (err, result) => {
      if (err) {
        console.log(err);
      } else {
        console.log(result);
      }
    });
  });
};

/*
// Enviar notificações a cada 10 segundos
setInterval(sendNotification, 10000);
*/


// Coordenadas do proximidade fixo (exemplo: posição do passageiro)
var latFixo = -23.593798331228253;
var lonFixo = -48.01770304206565;

// Coordenadas do proximidade de ônibus
var proximidadeOnibus = { 'lat': -23.59468, 'lon': -48.01904 }

var index = 0;


function moveBus() {
  if (index < coordenadas.length - 1) {
    console.log('Movendo ônibus para a próxima coordenada...');

    const [lat2, lon2] = coordenadas[index + 1];

    console.log('Latitude: ' + lat2 + ' Longitude: ' + lon2);

    // Atualizar a mensagem de distância
    updateDistance(lat2, lon2);

    index++;
  } else {
    // Reinicia o índice para que o loop recomece
    index = 0;
  }
}

// Função para calcular a distância entre dois proximidades usando Haversine
function calcularDistancia(lat1, lon1, lat2, lon2) {
  var R = 6371000; // Raio da Terra em metros
  var φ1 = lat1 * Math.PI / 180;
  var φ2 = lat2 * Math.PI / 180;
  var Δφ = (lat2 - lat1) * Math.PI / 180;
  var Δλ = (lon2 - lon1) * Math.PI / 180;

  var a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  var distancia = R * c;
  return distancia;
}

// Variáveis para controlar a posição anterior do ônibus e o estado do proximidade
var posicaoAnterior = null;
var passouPeloPonto = false;
var proximidade = false;

// Função para atualizar a mensagem de distância e enviar notificação
function updateDistance(lat2, lon2) {
  var latBus = lat2;
  var lonBus = lon2;

  console.log('Latitude ônibus: ' + latBus + ' Longitude ônibus: ' + lonBus);

  // Verifica se já há uma posição anterior registrada
  if (posicaoAnterior === null) {
    posicaoAnterior = { lat: latBus, lon: lonBus };
    console.log('Posição anterior do ônibus: ' + posicaoAnterior.lat + ', ' + posicaoAnterior.lon);
  }

  // Calcula a distância percorrida desde a última verificação
  var distanciaPercorrida = calcularDistancia(posicaoAnterior.lat, posicaoAnterior.lon, latBus, lonBus);

  // Calcula a distância entre o ônibus e o proximidade de ônibus
  var distanciaproximidadeOnibus = calcularDistancia(proximidadeOnibus.lat, proximidadeOnibus.lon, latBus, lonBus);
  console.log('A distância do ônibus em relação ao proximidade de ônibos é: ' + distanciaproximidadeOnibus);

  // Calcula a distância atual do ônibus ao proximidade do passageiro
  var distancia = calcularDistancia(latFixo, lonFixo, latBus, lonBus);
  var distanciaArredondada = Math.floor(distancia); // Arredonda para baixo para remover casas decimais

  // Verifica se a distância é menor ou igual a 200 metros e se proximidade é false
  if (distanciaArredondada <= 200 && !passouPeloPonto) {
    sendNotification("O ônibus está a 200 metros ou menos da posição do passageiro.");
  }

  console.log(distanciaArredondada, distanciaPercorrida);

  // condição proximidade de ônibus
  if (distanciaproximidadeOnibus < 50 && !passouPeloPonto) {
    sendNotification("O ônibus está no ponto de ônibus.");
    console.log('O ônibus está no ponto de ônibus.');
    passouPeloPonto = true; // Marca que o ônibus passou próximo ao passageiro
  }

  // Verifica se a distância é menor ou igual a 3000 metros e proximidade é false
  if (distanciaArredondada <= 3000 && !proximidade && !passouPeloPonto) {
    console.log('O ônibus está a ' + distanciaArredondada + ' metros da posição do passageiro.');
    if (distanciaPercorrida >= 500) {
      posicaoAnterior = { lat: latBus, lon: lonBus };
      // Envia a notificação
      sendNotification('O ônibus está a ' + distanciaArredondada + ' metros da sua posição.');
      console.log('O ônibus está a ' + distanciaArredondada + ' metros da sua posição.');
    }
  } else if (distanciaproximidadeOnibus > 50 && distanciaproximidadeOnibus <= 100) {
    posicaoAnterior = { lat: latBus, lon: lonBus };
    // Envia a notificação
    sendNotification('O ônibus já passou pelo ponto e está a ' + distanciaArredondada + ' metros da sua posição.');
    console.log('O ônibus já passou pelo ponto e está a ' + distanciaArredondada + ' metros da sua posição.');
    proximidade = false;
  } else if (distanciaArredondada > 200 && passouPeloPonto) {
    message.innerHTML = 'O ônibus está a mais de ' + distanciaArredondada + ' km da posição do passageiro.';
    console.log('O ônibus está a mais de ' + distanciaArredondada + ' km da posição do passageiro.');
  }
}

// Chame a função moveBus repetidamente para simular o movimento do ônibus
setInterval(moveBus, 3000); // Ajuste o intervalo conforme necessário (3000 ms = 3 segundos)
