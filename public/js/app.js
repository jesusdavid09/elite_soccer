if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(()=>{});
document.querySelectorAll('[data-confirm]').forEach(el=>el.addEventListener('click',e=>{if(!confirm(el.dataset.confirm))e.preventDefault();}));
