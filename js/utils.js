export const $=s=>document.querySelector(s);
export const on=(el,ev,fn)=>el.addEventListener(ev,fn);
export function showToast(msg,type='success'){
  const t=Object.assign(document.createElement('div'),{className:`p-3 rounded text-white text-sm mb-2 ${type==='error'?'bg-red-600':'bg-green-600'}`});t.textContent=msg;
    $('#toast-container').appendChild(t);
      setTimeout(()=>t.remove(),3000);
      }
      const modalContainer=$('#modal-container');
      export function showModal({title,content}){
        modalContainer.innerHTML=`
            <div class="modal fixed inset-0 flex items-center justify-center z-50">
                  <div class="modal-overlay absolute inset-0 bg-black opacity-80"></div>
                        <div class="modal-content rounded-lg w-full max-w-md p-6 mx-4 max-h-screen overflow-y-auto relative z-10">
                                <div class="flex justify-between items-center mb-4">
                                          <h2 class="text-xl font-bold text-purple-400">${title}</h2>
                                                    <button onclick="hideModal()" class="text-gray-400 hover:text-white"><i class="fas fa-times"></i></button>
                                                            </div>
                                                                    ${content}
                                                                          </div>
                                                                              </div>`;
                                                                              }
                                                                              export function hideModal(){modalContainer.innerHTML='';}
                                                                              