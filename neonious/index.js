let http = require('http');
// this is neonious-specify, dear IDE.
// noinspection NpmUsedModulesInstalled
let gpio = require('gpio');

// Example from neonious itself. Not related to the rest of the program.
gpio.pins[gpio.BUTTON].on('fall', () => {
    console.log('Button pressed!')
});

// Keep the state of the leds in globals.
// Also the JSON-like text of the HTTP response is kept ready to alleviate polling 
let ledRedState = false, ledGreenState = false, jsonStatus = "{}";

// Time in milliseconds for the debouncer functions
const debounceTime = 200;

// I call pin 25 the 'green pin' because it also makes the green LED light up
const greenPin = gpio.pins[25];

// I call pin 24 the 'red pin' because it also makes the red LED light up
const redPin = gpio.pins[24];

// Callbacks for when pins are touched, already debounced.
function greenPinHit () {
    ledGreenState = !ledGreenState;
    gpio.pins[gpio.LED_GREEN].setValue(ledGreenState);
    jsonStatus = getPinosStatusJSON();
}

function redPinHit () {
    ledRedState = !ledRedState;
    gpio.pins[gpio.LED_RED].setValue(ledRedState);
    jsonStatus = getPinosStatusJSON();
}

function getPinosStatusJSON () {
    return `{"red":${ledRedState ? "true" : "false"}, "green":${ledGreenState ? "true" : "false"}}`;
}


// pay me a beer and I'll tell you why this code is duplicated; or, ask neonious...
let debounceTimeoutGreenPin = null;
greenPin.setType(gpio.INPUT);
greenPin.on('fall', () => {
    if (debounceTimeoutGreenPin) {
        clearTimeout(debounceTimeoutGreenPin);
        debounceTimeoutGreenPin = null;
    }
    if (!debounceTimeoutGreenPin) {
        debounceTimeoutGreenPin = setTimeout(() => {
            redPinHit();
            debounceTimeoutGreenPin = null;
        }, debounceTime);
    }
});


let debounceTimeoutRedPin = null;
redPin.setType(gpio.INPUT);
redPin.on('fall', () => {
    if (debounceTimeoutRedPin) {
        clearTimeout(debounceTimeoutRedPin);
        debounceTimeoutRedPin = null;
    }
    if (!debounceTimeoutRedPin) {
        debounceTimeoutRedPin = setTimeout(() => {
            greenPinHit();
            debounceTimeoutRedPin = null;
        }, debounceTime);
    }
});


// Create a webserver that returns the JSON status string for any request.
http.createServer(function (req, res) {
    res.write(jsonStatus);
    res.end();
}).listen(80);

console.log("neonious-hue web server running!");
