"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function promisify(obj, func, ...args) {
    console.log("getting promise");
    return new Promise((resolve, reject) => {
        console.log("start of promise");
        obj[func].apply(obj, args.concat((err, result) => {
            if (err != null) {
                console.log("REJECT");
                console.log("ERR:", err, result);
                reject(err);
            }
            else {
                console.log("resolve");
                resolve(result);
            }
        }));
    });
}
exports.default = promisify;
