import fs from "node:fs";

const files = process.argv.slice(2).flatMap((arg) => arg.startsWith("@") ? fs.readFileSync(arg.slice(1), "utf8").split(/\r?\n/) : [arg]).filter(Boolean);
const red = /(^|\/)(checkout|payment|stripe|auth|inventory|reservation|supabase|migrations?|functions)(\/|\.|$)|guest.*design|webhook/i;
const yellow = /custom-studio|(^|\/)(cart|shipping|admin|dtf)(\/|\.|$)/i;
let risk = "GREEN";
if (files.some((file) => red.test(file))) risk = "RED";
else if (files.some((file) => yellow.test(file))) risk = "YELLOW";
console.log(risk);
