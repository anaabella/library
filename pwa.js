javascript
export function initPWA(){
  if('serviceWorker' in navigator){
      navigator.serviceWorker.register('/sw.js').then(()=>console.log('SW registrado')).catch(console.error);
        }
        }
