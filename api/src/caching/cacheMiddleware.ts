import MemoryCacheEngine from "./memoryCacheEngine";

const cacheEngine = new MemoryCacheEngine();

interface CachedObject {
  headers: any;
  status: any;
  body: string;
}

export default function cacheMiddleware(seconds: number) {
  return (req, res, next) => {
    const duration = seconds * 1000;

    let key = "__cache__" + (req.originalUrl || req.url) + JSON.stringify(req.body);
    const cachedObject = cacheEngine.getFromCache(key) as CachedObject;
    if (cachedObject) {
      res.writeHead(cachedObject.status || 200, cachedObject.headers);
      return res.end(cachedObject.body);
    } else {
      res.sendResponse = res.send;
      res.send = (body) => {
        if (typeof body === "string") {
          const cacheObject: CachedObject = { status: res.statusCode, headers: res.getHeaders ? res.getHeaders() : res._headers, body: body };
          cacheEngine.storeInCache(key, cacheObject, duration);
        }
        res.sendResponse(body);
      };
      next();
    }
  };
}
