const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const PushNotifications = require("node-pushnotifications");
const cors = require("cors");

require("dotenv").config(); // Carrega as variáveis de ambiente do arquivo .env

const app = express();


// Variáveis para controlar a posição anterior do ônibus e o estado do ponto
var posicaoAnterior = null;
var passouPeloPonto = false;
var proximidade = false;
var notificado2500m = true;
var notificaPassageiro = true;
var velocidadeMedia = 60; // Velocidade média em km/h https://www5.usp.br/noticias/comportamento/faixas-exclusivas-aumentaram-a-velocidade-media-dos-onibus/


//Importar rota de teste
const { coordenadas } = require('./rota');

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
const sendNotification = (body) => {
  const payload = { title: "KDBus", body: body };
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

// Coordenadas do proximidade fixo (exemplo: posição do passageiro)
var latFixo = -23.593798331228253;
var lonFixo = -48.01770304206565;

// Coordenadas do proximidade de ônibus
var proximidadeOnibus = { 'lat': -23.59468, 'lon': -48.01904 };

var index = 0;

// Função para mover o ônibus
function moveBus() {
  if (index < coordenadas.length - 1) {
    // console.log('Movendo ônibus para a próxima coordenada...');

    const [lat2, lon2] = coordenadas[index + 1];

    console.log('Latitude: ' + lat2 + ' Longitude: ' + lon2);

    // Atualizar a mensagem de distância
    updateDistance(lat2, lon2);

    index++;
  } else {
    // Reinicia o índice para que o loop recomece
    index = 0;
    notificado2500m = true;
    passouPeloPonto = false;

    console.log('\n\n reinicia o loop com true ' + notificado2500m + '\n\n');
  }
}

// Função para calcular a distância entre dois pontos usando Haversine
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
// Função para calcular o tempo estimado em horas, minutos e segundos
function calcularTempo(distanciaKm, velocidadeKmh) {
  var tempoTotalMinutos = (distanciaKm / velocidadeKmh) * 60;
  var horas = Math.floor(tempoTotalMinutos / 60);
  var minutos = Math.floor(tempoTotalMinutos % 60);
  var segundos = Math.floor((tempoTotalMinutos * 60) % 60);

  return {
    horas: horas,
    minutos: minutos,
    segundos: segundos
  };
}
// Função para formatar o tempo em hh:mm:ss
function formatarTempo(tempo) {
  var horas = tempo.horas.toString().padStart(2, '0');
  var minutos = tempo.minutos.toString().padStart(2, '0');
  var segundos = tempo.segundos.toString().padStart(2, '0');
  return `${horas}:${minutos}:${segundos}`;
}


// Função para atualizar a mensagem de distância e enviar notificação
function updateDistance(latBus, lonBus) {
  //console.log('Latitude ônibus: ' + latBus + ' Longitude ônibus: ' + lonBus);

  console.log('\n inicia o loop com true ' + notificado2500m + '\n');


  // Verifica se já há uma posição anterior registrada
  if (posicaoAnterior === null) {
    posicaoAnterior = { lat: latBus, lon: lonBus };
    console.log('Posição anterior do ônibus antes de teste de distância: ' + posicaoAnterior.lat + ', ' + posicaoAnterior.lon);
  }

  // Calcula a distância percorrida desde a última verificação
  var distanciaPercorrida = calcularDistancia(posicaoAnterior.lat, posicaoAnterior.lon, latBus, lonBus);
  //console.log('Distância percorrida: ' + distanciaPercorrida);

  // Calcula a distância atual do ônibus ao proximidade do passageiro
  var distanciaOnibusPassageiro = calcularDistancia(latFixo, lonFixo, latBus, lonBus);
  var distanciaOnibusPonto = calcularDistancia(proximidadeOnibus.lat, proximidadeOnibus.lon, latBus, lonBus);

  var distanciaArredondada = Math.floor(distanciaOnibusPassageiro); // Arredonda para baixo para remover casas decimais

  // Converte a distância para quilômetros
  var distanciaKm = distanciaOnibusPassageiro / 1000;

  // Calcula o tempo estimado em horas, minutos e segundos
  var tempoEstimado = calcularTempo(distanciaKm, velocidadeMedia);
  var tempoEstimadoFormatado = formatarTempo(tempoEstimado);

  console.log('Distancia entre o ônibus e o passageiro = ' + distanciaOnibusPassageiro + ' - ' + notificado2500m + '\n\n');

  if (distanciaOnibusPassageiro <= 2500 && notificado2500m === true) {
    console.log('\n\n ==================================================================================================> O ônibus está a 2,5 km da sua posição. \n\n\n');


    if (distanciaPercorrida >= 500) {
      console.log('O ônibus percorreu 500 metros desde a última verificação.');





      if (distanciaOnibusPassageiro <= 200) {
        console.log('O ônibus está a 200 metros da sua posição.');



        if (distanciaOnibusPonto <= 50 && !passouPeloPonto) {

          sendNotification("O ônibus está no ponto de ônibus.");
          passouPeloPonto = true;

        } else if (distanciaOnibusPonto > 50 && !passouPeloPonto) {

          sendNotification("O ônibus está próximo!!!");

        }


      } else if (distanciaPercorrida > 200 && passouPeloPonto === true && notificado2500m === true) {

        sendNotification("O ônibus já passou pelo ponto.");
        notificado2500m = false;
        console.log('\n segundo if false ' + notificado2500m + '\n')

      } else {

        //sendNotification("O ônibus está a " + distanciaArredondada + " metros da sua posição.");

        // Calcula e notifica o tempo estimado a cada 500 metros percorridos
        sendNotification("O ônibus está a " + distanciaArredondada + " metros da sua posição. Ele chegará em aproximadamente " + tempoEstimadoFormatado + ".");

      }

      // Atualiza a posição anterior para a nova posição do ônibus
      posicaoAnterior = { lat: latBus, lon: lonBus };
      //console.log('Nova posição anterior do ônibus: ' + posicaoAnterior.lat + ', ' + posicaoAnterior.lon);
      //console.log('Distância dentro do loop '+ distanciaOnibusPassageiro + '\n' );

    }




  }




}


// Chame a função moveBus repetidamente para simular o movimento do ônibus
setInterval(moveBus, 150); // Ajuste o intervalo conforme necessário (3000 ms = 3 segundos)
