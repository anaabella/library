const DB_NAME='annaLibrary',STORE='books',VERSION=1;
let dbInstance,allBooks=[];
export const books={
  async load(){
      await openDB();
          allBooks=await getAll();
            },
              all:()=>allBooks,
                async saveBook(book){
                    book.id=crypto.randomUUID();
                        book.read=book.read||false;book.rating=book.rating||0;
                            if(book.coverFile&&book.coverFile.size>1_000_000){
                                  book.cover=await fileToDataURL(book.coverFile);
                                      }else if(book.coverFile){
                                            book.cover=await fileToDataURL(book.coverFile);
                                                }else{book.cover=book.coverUrl||'';}
                                                    delete book.coverFile;delete book.coverUrl;
                                                        allBooks.push(book);
                                                            await put(book);
                                                              },
                                                                async toggleRead(id){
                                                                    const b=allBooks.find(x=>x.id===id);
                                                                        if(b){b.read=!b.read;await put(b);}
                                                                          },
                                                                            async updateRating(id,rating){
                                                                                const b=allBooks.find(x=>x.id===id);
                                                                                    if(b){b.rating=rating;await put(b);}
                                                                                      },
                                                                                        async deleteBook(id){
                                                                                            allBooks=allBooks.filter(x=>x.id!==id);
                                                                                                await deleteRecord(id);
                                                                                                  },
                                                                                                    async import(data){
                                                                                                        allBooks=data;await clearStore();
                                                                                                            for(const b of allBooks)await put(b);
                                                                                                              },
                                                                                                                clear:async()=>{allBooks=[];await clearStore();}
                                                                                                                };
                                                                                                                function openDB(){
                                                                                                                  return new Promise((res,rej)=>{
                                                                                                                      const req=indexedDB.open(DB_NAME,VERSION);
                                                                                                                          req.onupgradeneeded=()=>{
                                                                                                                                const db=req.result;
                                                                                                                                      if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});
                                                                                                                                          };
                                                                                                                                              req.onsuccess=()=>{dbInstance=req.result;res();};
                                                                                                                                                  req.onerror=()=>rej(req.error);
                                                                                                                                                    });
                                                                                                                                                    }
                                                                                                                                                    function getAll(){return promisify('getAll');}
                                                                                                                                                    function put(obj){return promisify('put',obj);}
                                                                                                                                                    function deleteRecord(id){return promisify('delete',id);}
                                                                                                                                                    function clearStore(){return promisify('clear');}
                                                                                                                                                    function promisify(method,arg){
                                                                                                                                                      return new Promise((res,rej)=>{
                                                                                                                                                          const tx=dbInstance.transaction(STORE,'readwrite'),store=tx.objectStore(STORE),req=store[method](arg);
                                                                                                                                                              req.onsuccess=()=>res(req.result);
                                                                                                                                                                  req.onerror=()=>rej(req.error);
                                                                                                                                                                    });
                                                                                                                                                                    }
                                                                                                                                                                    function fileToDataURL(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result);r.onerror=rej;r.readAsDataURL(file);});}
                                                                                                                                                                    