import{books,saveBook,deleteBook}from'./storage.js';
import{showModal,hideModal,showToast,$,byId}from'./utils.js';
import{sagas}from'./sagas.js';

let bookGrid=byId('book-grid'),search=byId('search'),sort=byId('sort');
export async function loadBooks(){await books.load();}
export function renderGrid(){bookGrid.innerHTML=books.all().map(card).join('');}
export function filterAndRender(){
  let q=search.value.trim().toLowerCase(),s=sort.value;
    let filtered=books.all().filter(b=>b.title.toLowerCase().includes(q)||b.author.toLowerCase().includes(q));
      filtered.sort((a,b)=>a[s].localeCompare(b[s]));
        bookGrid.innerHTML=filtered.map(card).join('');
        }
        export function recommendBook(){
          let unread=books.all().filter(b=>!b.read);
            if(!unread.length)return showToast('¡Has leído todo!');
              let pick=unread[Math.floor(Math.random()*unread.length)];
                showToast(`¿Por qué no lees “${pick.title}”?`);
                }
                export function showNewBookModal(){
                  showModal({title:'Agregar libro',content:`
                      <form id="book-form" class="space-y-4">
                            <input name="title" required class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" placeholder="Título">
                                  <input name="author" required class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" placeholder="Autor">
                                        <input name="series" class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" placeholder="Saga (opcional)">
                                              <div class="flex gap-2">
                                                      <input name="coverUrl" class="flex-1 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" placeholder="URL portada">
                                                              <input name="coverFile" type="file" accept="image/*" class="flex-1 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white">
                                                                    </div>
                                                                          <div class="flex justify-end gap-3">
                                                                                  <button type="button" class="btn-gray" onclick="hideModal()">Cancelar</button>
                                                                                          <button class="btn-purple">Guardar</button>
                                                                                                </div>
                                                                                                    </form>`});
                                                                                                      on('#book-form','submit',async e=>{
                                                                                                          e.preventDefault();
                                                                                                              const f=new FormData(e.target);
                                                                                                                  await saveBook({title:f.get('title'),author:f.get('author'),series:f.get('series'),coverUrl:f.get('coverUrl'),coverFile:f.get('coverFile')});
                                                                                                                      hideModal();renderGrid();showToast('Libro guardado');
                                                                                                                        });
                                                                                                                        }
                                                                                                                        export function exportCSV(){
                                                                                                                          const rows=['Título,Autor,Saga,Leído,Puntuación'];
                                                                                                                            books.all().forEach(b=>rows.push(`"${b.title}","${b.author}","${b.series||''}",${b.read},${b.rating}`));
                                                                                                                              const blob=new Blob([rows.join('\n')],{type:'text/csv'});
                                                                                                                                const url=URL.createObjectURL(blob);
                                                                                                                                  const a=Object.assign(document.createElement('a'),{href:url,download:'biblioteca.csv'});
                                                                                                                                    a.click();URL.revokeObjectURL(url);
                                                                                                                                    }
                                                                                                                                    export function resetLibrary(){
                                                                                                                                      if(!confirm('¿Borrar TODA la biblioteca?'))return;
                                                                                                                                        books.clear();renderGrid();showToast('Biblioteca reiniciada');
                                                                                                                                        }
                                                                                                                                        export function showRestoreModal(){
                                                                                                                                          showModal({title:'Restaurar backup',content:`
                                                                                                                                              <p class="text-sm text-gray-400 mb-4">Selecciona un archivo .json previo:</p>
                                                                                                                                                  <input type="file" id="restore-file" accept=".json" class="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white mb-4">
                                                                                                                                                      <div class="flex justify-end gap-3">
                                                                                                                                                            <button class="btn-gray" onclick="hideModal()">Cancelar</button>
                                                                                                                                                                  <button class="btn-purple" onclick="restoreJSON()">Restaurar</button>
                                                                                                                                                                      </div>`});
                                                                                                                                                                      }
                                                                                                                                                                      async function restoreJSON(){
                                                                                                                                                                        const file=byId('restore-file').files[0];
                                                                                                                                                                          if(!file)return;
                                                                                                                                                                            const txt=await file.text();
                                                                                                                                                                              try{await books.import(JSON.parse(txt));renderGrid();hideModal();showToast('Backup restaurado');}catch(e){showToast('Error en archivo','error');}
                                                                                                                                                                              }
                                                                                                                                                                              function card(b){
                                                                                                                                                                                const src=b.cover||(b.coverUrl||'https://via.placeholder.com/120x180?text=Libro');
                                                                                                                                                                                  return`<div class="book-card bg-gray-800 rounded-lg p-3 relative">
                                                                                                                                                                                      <img src="${src}" class="w-full h-40 object-cover rounded-md mb-2 ${!b.read?'filter grayscale':''}">
                                                                                                                                                                                          <div class="absolute top-2 right-2 flex gap-2">
                                                                                                                                                                                                <button onclick="toggleRead('${b.id}')" class="text-xs bg-gray-700 px-2 py-1 rounded">${b.read?'✔':'○'}</button>
                                                                                                                                                                                                      <button onclick="removeBook('${b.id}')" class="text-xs bg-red-700 px-2 py-1 rounded">✖</button>
                                                                                                                                                                                                          </div>
                                                                                                                                                                                                              <h4 class="font-semibold truncate">${b.title}</h4>
                                                                                                                                                                                                                  <p class="text-xs text-gray-400">${b.author}</p>
                                                                                                                                                                                                                      <div class="mt-2">${stars(b.rating,b.id)}</div>
                                                                                                                                                                                                                        </div>`;
                                                                                                                                                                                                                        }
                                                                                                                                                                                                                        window.toggleRead=async id=>{await books.toggleRead(id);renderGrid();};
                                                                                                                                                                                                                        window.removeBook=async id=>{if(confirm('¿Eliminar libro?')){await deleteBook(id);renderGrid();}};
                                                                                                                                                                                                                        window.updateRating=async(id,rating)=>{await books.updateRating(id,rating);};
                                                                                                                                                                                                                        function stars(rating,id){
                                                                                                                                                                                                                          let html='';for(let i=1;i<=5;i++)html+=`<span class="cursor-pointer ${i<=(rating||0)?'text-yellow-400':'text-gray-600'}" onclick="updateRating('${id}',${i})">★</span>`;return html;
                                                                                                                                                                                                                          }
                                                                                                                                                                                                                          