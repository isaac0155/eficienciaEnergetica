
var ret = (io) => {
    const express = require('express');
    const router = express.Router();
    const pool = require('../database');
    const { isLoggedIn } = require('../lib/auth')
    const { isAdminGen } = require('../lib/auth')
    const { isAdminSucur } = require('../lib/auth')
    const upload = require('../lib/storage')

    io.on("connection", (socket) => {

        socket.on('client:iluminacion', async () => {
            var iluminacion = await pool.query('select * from iluminacion where idiluminacion = 1');
            socket.emit('server:iluminacion', iluminacion[0]);
        });
    });

    
    //servidor de eficiencia energética
    router.get('/calcEficienciaEnergetica', async (req, res) => {
        res.render('universidad/een/index');
    });
    router.get('/calcEficienciaEnergetica/calculadora', async (req, res) => {
        res.render('universidad/een/calculadora');
    });
    router.get('/calcEficienciaEnergetica/eficienciailuminacion', async (req, res) => {
        res.render('universidad/een/eficienciailuminacion');
    });
    router.get('/calcEficienciaEnergetica/vertodo/', async (req, res) => {
        var todos = await pool.query('select * from energia')
        res.render('universidad/een/vertodos', { todos });
    });
    router.get('/calcEficienciaEnergetica/ver/:id', async (req, res) => {
        var eficiencia = await pool.query('select * from energia where idEnergia = ?;', req.params.id)

        const fecha = new Date(eficiencia[0].fecha);
        const dia = fecha.getDate();
        const mes = fecha.getMonth() + 1;
        const anio = fecha.getFullYear();
        const hora = fecha.getHours();
        const minutos = fecha.getMinutes();
        const diaFormateado = dia < 10 ? `0${dia}` : dia;
        const mesFormateado = mes < 10 ? `0${mes}` : mes;
        const horaFormateada = hora < 10 ? `0${hora}` : hora;
        const minutosFormateados = minutos < 10 ? `0${minutos}` : minutos;
        const fechaFormateada = `${diaFormateado}/${mesFormateado}/${anio} - ${horaFormateada}:${minutosFormateados}`;

        eficiencia[0].fecha = fechaFormateada;
        var resultado = JSON.parse(eficiencia[0].detalle);

        resultado.forEach((element, index) => {
            var datos = [element];
            datos.forEach((tipe, ind) => {
                tipe.detalle.forEach((data, indx) => {
                    //console.log(resultado[index].detalle[indx]);
                    var tipo_foco = resultado[index].detalle[indx].tipo_foco
                    var lumenes = resultado[index].detalle[indx].lumenes
                    var cantidad = resultado[index].detalle[indx].cantidad
                    var potencia = resultado[index].detalle[indx].potencia
                    var consumo_diario = resultado[index].detalle[indx].consumo_diario
                    var area_iluminada = resultado[index].detalle[indx].area_iluminada

                    if (tipo_foco != 'led') {
                        tipo_foco = 'Es recomendable usar iluminación LED'
                    } else {
                        tipo_foco = 'Ninguna Observación'
                    }
                    var lumenes1 = calcularLumenes(area_iluminada);
                    var lumenes2 = 'Para iluminar adecuadamente su ambiente de ' + area_iluminada + ' m2. se necesita un foco led de: ' + lumenes1[0].lumenes + ' Lm. y el foco de usted es de: ' + (lumenes * area_iluminada * cantidad);
                    var consumoActual = ((potencia / 1000) * (consumo_diario * 30)).toFixed(2);
                    var consumoEficiente = ((calcularPotenciaFoco(lumenes1[0].lumenes / area_iluminada) / 1000) * (consumo_diario * 30)).toFixed(2);

                    var observacion = {
                        tipo_foco,
                        lumenes2,
                        potenciaSugerida: 'La potencia Sugeriada es de ' + calcularPotenciaFoco(lumenes1[0].lumenes) / 15 + ' Watts.',
                        consumoActual,
                        consumoEficiente,
                        pagoAcutal: 'Usted paga ahora ' + consumoActual * 1.21 + ' Bs. Y con los cambios usted paga: ' + consumoEficiente * 1.21 + ' Bs.',
                        diferencia: 'Ahorro mensualmente ' + ((consumoActual * 1.21) - (consumoEficiente * 1.21)) + ' Bs. solo en iluminacion de este ambiente'
                    }
                    resultado[index].detalle[indx].observacion = observacion;
                });
            });
        });

        //res.send(resultado)
        res.render('universidad/een/ver', { eficiencia: eficiencia[0], resultado });
    });

    function calcularPotenciaFoco(lumenes) {
        // Eficiencia lumínica promedio de los focos LED
        const eficienciaLuminica = 100; // lm/W (valor promedio)

        // Cálculo de la potencia en vatios
        const potencia = lumenes / eficienciaLuminica;

        // Redondeo de la potencia a dos decimales
        const potenciaRedondeada = potencia.toFixed(2);

        return potenciaRedondeada
    }

    function calcularLumenes(metrosCuadrados) {
        const areas = [
            { iluminancia: 750 }
        ];

        const resultados = [];

        areas.forEach(area => {
            const lumenesNecesarios = area.iluminancia * metrosCuadrados;
            resultados.push({ lumenes: lumenesNecesarios });
        });

        return resultados;
    }

    router.post('/calcEficienciaEnergetica/eficienciailuminacion', async (req, res) => {

        //ordena los datos recibidos de body
        console.log(req.body);
        var newres = req.body;
        if (Array.isArray(newres['nombre_ambiente[]'])) {
            //console.log(true)
        } else {
            //console.log(false)
            newres['nombre_ambiente[]'] = [newres['nombre_ambiente[]']]
        }

        const datosRecibidos = newres;
        const resultadoFinal = {};

        for (const campo in datosRecibidos) {
            if (campo.includes('[]')) {
                const matches = campo.match(/(\w+)_(\d+)\[\]/);
                if (matches) {
                    const [, nombreCampo, indice] = matches;
                    const valores = Array.isArray(datosRecibidos[campo]) ? datosRecibidos[campo] : [datosRecibidos[campo]];
                    for (let i = 0; i < valores.length; i++) {
                        const valor = valores[i];
                        if (!resultadoFinal[indice]) {
                            resultadoFinal[indice] = {};
                        }
                        if (!resultadoFinal[indice][i]) {
                            resultadoFinal[indice][i] = {};
                        }
                        resultadoFinal[indice][i][nombreCampo] = valor;
                    }
                }
            }
        }

        const ambientes = datosRecibidos['nombre_ambiente[]'];
        //console.log(ambientes);
        const resultadoFinalOrdenado = {};

        for (let i = 0; i < ambientes.length; i++) {
            const ambiente = ambientes[i];
            resultadoFinalOrdenado[ambiente] = resultadoFinal[i];
        }
        //var resultado = JSON.stringify(resultadoFinalOrdenado, null, 2);

        //los datos recibidos se tratan para osarlos con hbs y guardar a la db
        var resultados = Object.entries(resultadoFinalOrdenado).map(([nombre, detalle]) => ({
            nombre,
            detalle: Object.values(detalle)
        }));
        resultados = JSON.stringify(resultados, null, 2);
        //console.log(resultados)
        var instr = await pool.query('INSERT INTO energia (fecha, detalle) VALUES (DEFAULT, ?)', resultados);
        res.redirect('/links/calcEficienciaEnergetica/ver/' + instr.insertId)
    });

    return router
}

module.exports = ret