export default function promisify<T>(
  obj: Object,
  func: string,
  ...args: Array<any>
): Promise<T> {
	console.log("getting promise");
  return new Promise((resolve, reject) => {
	  console.log("start of promise");
    obj[func].apply(
      obj,
      args.concat((err, result) => {
        if (err != null) {
		console.log("REJECT");
		console.log("ERR:",err,result);
          reject(err);
        } else {
		console.log("resolve");
          resolve(result);
        }
      })
    );
  });
}
