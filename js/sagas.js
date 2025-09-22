import{books}from'./storage.js';
export let sagas=[];
export async function loadSagas(){await books.load();build();}
function build(){
  const map=new Map();
    books.all().forEach(b=>{
        if(!b.series)return;
            if(!map.has(b.series))map.set(b.series,{name:b.series,author:b.author,total:0,read:0});
                const s=map.get(b.series);s.total++;if(b.read)s.read++;
                  });
                    sagas=Array.from(map.values()).map(s=>({...s,completed:s.read===s.total}));
                      renderStats();
                      }
                      function renderStats(){
                        $('#total-sagas').textContent=sagas.length;
                          $('#completed-sagas').textContent=sagas.filter(s=>s.completed).length;
                            $('#read-count').textContent=books.all().filter(b=>b.read).length;
                              const avg=books.all().reduce((a,b)=>a+b.rating,0)/(books.all().length||1);
                                $('#avg-rating').textContent=avg.toFixed(1);
                                }
                                