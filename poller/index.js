const hue = require('hue-sdk');
const axios = require('axios');
let keepAliveAgent = new require("http").Agent({keepAlive: true});

let config = {
    "hueUser": process.env['HUE_USER'],
    "hueHost": process.env['HUE_HOST'],
    "neoniousHost": process.env['NEONIOUS_HOST'],
    "redLightId": process.env['RED_LIGHT_ID'],
    "greenLightId": process.env['GREEN_LIGHT_ID']
};
let hueClient = new hue.Hue({host: config.hueHost, user: config.hueUser});

console.log("Config from env: ");
console.dir(config);

// Run it!
mainAsync().catch(reason => console.error(reason.message, reason.stack));


// Handlers. Actually change the lights.
async function greenChanged (now, before) {
    console.log("GREEN changed from ", before, " to ", now);
    await setHueLightState(config.greenLightId, !!now);
}

async function redChanged (now, before) {
    console.log("RED changed from ", before, " to ", now);
    await setHueLightState(config.redLightId, !!now);
}

async function mainAsync () {
    // Interrupt handling, I'm ashamed.
    let interruptCount = 0;
    let interrupted = false;
    let interruptHandler = function () {
        console.log("SIGTERM or SIGINT received, dying.");
        interrupted = true;
        interruptCount++;
        if (interruptCount > 2) {
            console.error("Too many interrupts, force exit.");
            process.exit(8);
        }
    };
    process.on('SIGTERM', interruptHandler);
    process.on('SIGINT', interruptHandler);


    // Check Hue and Lights config...
    let hueLights = null;
    console.log("--- Testing connection to Hue...");
    try {
        hueLights = await getHueLightsDataAsync();
    } catch (e) {
        console.error("Error talking to Hue: ", e);
        process.exit(3);
    }

    if (!hueLights[config.redLightId]) {
        console.error(`Could not find (red) light ID ${config.redLightId} in Hue Config.`);
        process.exit(4);
    }
    console.log(`   \\--- RED will control Hue light '${hueLights[config.redLightId].name}' which is a '${hueLights[config.redLightId].type}'.`);

    if (!hueLights[config.greenLightId]) {
        console.error(`Could not find (green) light ID ${config.greenLightId} in Hue Config.`);
        process.exit(5);
    }
    console.log(`   \\--- GREEN will control Hue light '${hueLights[config.greenLightId].name}' which is a '${hueLights[config.greenLightId].type}'.`);


    // Check we can talk to the Neonious
    let neoniousUrl = `http://${config.neoniousHost}/url/does/not/matter/just/poll`;
    console.log("--- Initializing connection to Neonious...");
    let resp = null;
    try {
        resp = await axios.get(neoniousUrl, {timeout: 10000, httpAgent: keepAliveAgent});
    } catch (e) {
        console.error("Error contacting Neonious", e.message, e.stack);
        process.exit(2);
    }

    let currRed = !!resp.data.red;
    let currGreen = !!resp.data.green;

    console.log(`   \\--- Connection to Neonious initialized. Red initially ${currRed}, Green initially ${currGreen}`);

    console.log("Entering main loop...");

    // Loop eternally polling Neonious and firing off the handler functions.
    while (!interrupted) {
        let resp = null;
        try {
            console.log("Sleeping...");
            await wait(1000); // let neonious breathe...
            console.log("Polling Neonious...");
            resp = await axios.get(neoniousUrl, {timeout: 3000, httpAgent: keepAliveAgent});
        } catch (e) {
            console.error("Error polling neonious", e.message, e.stack);
            await wait(5000);
            console.log("Slept 5s, lets try again.");
            continue;
        }

        try {

            if (!!resp.data.green !== !!currGreen) {
                await greenChanged(!!resp.data.green, !!currGreen);
                currGreen = !!resp.data.green;
            }

            if (!!resp.data.red !== !!currRed) {
                await redChanged(!!resp.data.red, !!currRed);
                currRed = !!resp.data.red;
            }
        } catch (e) {
            console.error("Error handling touch ", e.message, e.reason);
        }

    }
}

// Promisify hueClient.lights()
function getHueLightsDataAsync () {
    return new Promise(function (resolve, reject) {
        hueClient.lights(function (err, data) {
            if (err !== null) reject(err);
            if (data && data[0] && data[0].error) reject(data[0].error.description);
            else resolve(data);
        });
    });
}

// Promisify hueClient.lights()
function setHueLightState (lightId, onOff) {
    return new Promise(function (resolve, reject) {
        hueClient.setLightState(lightId, {on: onOff}, function (err, data) {
            if (err !== null) reject(err);
            if (data && data[0] && data[0].error) reject(data[0].error.description);
            else resolve(data);
        });
    });
}

// Wait func promisified.
function wait (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

