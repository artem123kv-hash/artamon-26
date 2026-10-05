/* ============================================================
   ARTAMON — Service Worker (PWA)
   ============================================================ */

const CACHE_NAME = "artamon-v2.6.5-v2";
const CACHE_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

/* Установка — кешируем основные файлы */
self.addEventListener("install", function(event){
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return Promise.all(
  CACHE_FILES.map(function(url){
    return cache.add(url).catch(function(){});
  })
);
    })
  );
});

/* Активация — удаляем старые версии кеша */
self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.map(function(key){
          if(key !== CACHE_NAME){
            return caches.delete(key);
          }
        })
      );
    }).then(function(){
      return self.clients.claim();
    })
  );
});

/* Fetch — сначала сеть, если нет — из кеша */
self.addEventListener("fetch", function(event){
  /* Не кешируем запросы к Worker API и внешним ресурсам */
  if(event.request.url.indexOf("workers.dev") !== -1 ||
     event.request.url.indexOf("artamon-api") !== -1){
    return;
  }

  /* Не кешируем POST */
  if(event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).then(function(response){
      /* Если ответ успешный — обновляем кеш */
      if(response && response.status === 200 && response.type === "basic"){
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache){
          cache.put(event.request, responseClone).catch(function(){});
        });
      }
      return response;
    }).catch(function(){
      /* Если нет сети — берём из кеша */
      return caches.match(event.request).then(function(cached){
        if(cached) return cached;
        /* Или отдаём index.html для навигации */
        if(event.request.mode === "navigate"){
          return caches.match("./index.html");
        }
      });
    })
  );
});
