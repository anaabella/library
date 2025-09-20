document.addEventListener('DOMContentLoaded', function() {
  // Capitaliza la primera letra de cada palabra y el resto en minúscula.
  function capitalizeWords(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, function(char) {
      return char.toUpperCase();
    })
  }

  // --- Configuración de Supabase ---
  const SUPABASE_URL = 'https://ntseicvopbxqozbgnstn.supabase.co'; // Pega aquí tu URL
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50c2VpY3ZvcGJ4cW96Ymduc3RuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzOTUzNzQsImV4cCI6MjA3Mzk3MTM3NH0.TNM9rQ_t4Dq_znHtxm_UHEl0KqC4yDY45Su8mKk1I2E'; // Reemplaza esto con la clave que copiaste de Supabase
  const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  // ---------------------------------

  const BookService = {
    books: [],

    loadBooks: async function() {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .order('series', { ascending: true }).order('position', { ascending: true }); // Ordenamos por saga y luego por posición

      if (error) {
        console.error('Error cargando libros desde Supabase:', error);
        this.books = [];
      } else {
        this.books = data;
        console.log('Libros cargados desde Supabase:', this.books);
      }
    },

    // saveBooks ya no es necesario, cada operación se guarda individualmente en Supabase.

    addBook: async function(book) {
      // Quitamos el ID que genera Date.now(), Supabase lo crea solo.
      const { id, ...bookData } = book; 
      const { data, error } = await supabase
        .from('books')
        .insert([bookData])
        .select()
        .single(); // .single() para obtener un solo objeto en lugar de un array
      
      if (error) {
        console.error('Error añadiendo libro:', error);
        return null;
      }
      this.books.push(data); // Añadimos el libro devuelto con el ID correcto
      return data;
    },

    findCoverAndUpdateUI: function(bookInfo, spinner, errorDiv, previewImg, formToLock = null) {
      const { title, author, series } = bookInfo;

      if (formToLock) formToLock.style.pointerEvents = 'none';
      spinner.classList.remove('hidden');
      errorDiv.classList.add('hidden');
      AppController.selectedCoverURL = null; // Reset before search

      const findCover = (query) => {
        return fetch(`https://openlibrary.org/search.json?q=${query}`)
          .then(response => response.json())
          .then(data => data.docs.slice(0, 10).find(doc => doc.cover_i && doc.author_name));
      };

      const specificQuery = `${title} ${author} ${series}`.trim().split(' ').join('+');
      findCover(specificQuery)
        .then(bookWithCover => {
          if (bookWithCover) return bookWithCover;
          const generalQuery = `${title} ${author}`.trim().split(' ').join('+');
          return findCover(generalQuery);
        })
        .then(bookWithCover => {
          if (bookWithCover) {
            const coverURL = `https://covers.openlibrary.org/b/id/${bookWithCover.cover_i}-L.jpg`;
            previewImg.src = coverURL;
            previewImg.parentElement.parentElement.classList.remove('hidden'); // Muestra el contenedor de la preview
            AppController.selectedCoverURL = coverURL;
          } else {
            const googleQuery = encodeURIComponent(`${title} ${author} book cover`);
            const googleImagesUrl = `https://www.google.com/search?tbm=isch&q=${googleQuery}`;
            errorDiv.innerHTML = `No se encontró. <a href="${googleImagesUrl}" target="_blank" class="text-blue-400 underline">Buscar en Google</a> y pega la URL.`;
            errorDiv.classList.remove('hidden');
            AppController.selectedCoverURL = null;
            
            // Si existe el input de URL, lo seleccionamos
            const urlRadio = document.getElementById('url-cover');
            if (urlRadio) urlRadio.click();
          }
        })
        .catch(err => {
          console.error('Error en la búsqueda de portada:', err);
          errorDiv.textContent = 'Ocurrió un error al buscar.';
          errorDiv.classList.remove('hidden');
          if (formToLock) formToLock.style.pointerEvents = 'auto'; // Reactivar formulario en caso de error
        })
        .finally(() => {
          spinner.classList.add('hidden');
          if (formToLock) formToLock.style.pointerEvents = 'auto';
          document.getElementById('fetch-cover-btn').disabled = false; // Siempre reactivar el botón
        });
    },

    deleteBook: async function(bookId) {
      const { error } = await supabase
        .from('books')
        .delete()
        .eq('id', bookId);

      if (error) console.error('Error eliminando libro:', error);
      else {
        this.books = this.books.filter(b => b.id !== bookId);
      }
    },

    setupAutocomplete: function(inputSelector, suggestionsSelector, getData) {
      const input = document.querySelector(inputSelector);
      const suggestionsContainer = document.querySelector(suggestionsSelector);

      if (!input || !suggestionsContainer) return;

      input.addEventListener('input', () => {
        const query = input.value.toLowerCase();
        suggestionsContainer.innerHTML = '';
        if (!query) {
          suggestionsContainer.classList.add('hidden');
          return;
        }

        const data = getData();
        const matchingItems = data.filter(item => item.toLowerCase().includes(query));

        if (matchingItems.length > 0) {
          matchingItems.forEach(item => {
            const suggestionDiv = document.createElement('div');
            suggestionDiv.textContent = item;
            suggestionDiv.className = 'p-2 cursor-pointer autocomplete-suggestion';
            suggestionDiv.onclick = () => {
              input.value = item;
              suggestionsContainer.classList.add('hidden');
            };
            suggestionsContainer.appendChild(suggestionDiv);
          });
          suggestionsContainer.classList.remove('hidden');
        } else {
          suggestionsContainer.classList.add('hidden');
        }
      });
    },

    importFromCSV: function(file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const csv = (typeof file === 'string') ? file : event.target.result;
        const lines = csv.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
          UI.showToast('El archivo CSV está vacío o no tiene el formato correcto.', 'error');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const newBooks = [];

        try {
          for (let i = 1; i < lines.length; i++) {
            // Simple CSV parsing, assumes no commas within quoted fields
            const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
            const book = {
              id: parseInt(values[0]),
              title: values[1].replace(/"/g, ''),
              author: values[2].replace(/"/g, ''),
              series: values[3].replace(/"/g, ''),
              read: values[4] === 'Sí',
              rating: parseFloat(values[5]),
              cover: values[6].trim()
            };
            newBooks.push(book);
          }
          this.books = newBooks;
          // Aquí tendrías que hacer un `insert` masivo a Supabase
          // NOTA: Esto es una operación avanzada. Por ahora, lo dejamos como carga local.
          // Para sincronizar, habría que borrar los libros actuales y subir los nuevos.
          // supabase.from('books').delete().neq('id', 0); // Borra todo
          // supabase.from('books').insert(newBooks.map(({id, ...rest}) => rest)); // Inserta los nuevos
          
          // Por ahora, solo renderizamos lo importado localmente.
          UI.renderBooks(); 
          // Aquí tendrías que hacer un `insert` masivo a Supabase
          UI.showToast('Biblioteca importada con éxito.');
        } catch (e) {
          UI.showToast('Error al procesar el archivo CSV. Asegúrate de que el formato es correcto.', 'error');
          console.error('Error parsing CSV:', e);
        }
      };
      if (typeof file === 'string') {
        reader.onload({ target: { result: file } });
      } else {
        reader.readAsText(file);
      }
      document.getElementById('csv-file-input').value = ''; // Reset for next import
    },

    exportToCSV: function(isAutoBackup = false) {
      const headers = ['ID', 'Título', 'Autor', 'Saga', 'Leído', 'Puntuación', 'URL Portada'];
      const rows = this.books.map(book => [
        book.id,
        `"${book.title.replace(/"/g, '""')}"`, // Handle quotes in title
        `"${book.author.replace(/"/g, '""')}"`,
        `"${book.series.replace(/"/g, '""')}"`,
        book.read ? 'Sí' : 'No',
        book.rating,
        book.cover
      ]);

      let csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(',') + '\n' 
        + rows.map(e => e.join(',')).join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `mi_biblioteca_${date}.csv`);
      
      if (!isAutoBackup) {
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Para backups automáticos, guardamos el contenido en localStorage
        localStorage.setItem(`backup_${date}`, csvContent);
      }
    },

    setupAutoBackup: function() {
      const backupHistory = JSON.parse(localStorage.getItem('sagaTracker_backupHistory') || '[]');
      const wasModified = localStorage.getItem('libraryModified') === 'true';
      const today = new Date().toISOString().slice(0, 10); // Formato YYYY-MM-DD

      // Solo hacer backup si no se ha hecho hoy Y si ha habido modificaciones.
      if (wasModified && !backupHistory.includes(today)) {
        if (this.books.length > 0) {
          // Exporta sin descargar el archivo visiblemente.
          this.exportToCSV(true);

          // Añade la fecha de hoy al historial.
          backupHistory.push(today);

          // Si hay más de 3 backups, elimina el más antiguo.
          if (backupHistory.length > 3) {
            const oldestBackupDate = backupHistory.shift(); // Elimina y obtiene la fecha más vieja
            if (oldestBackupDate) {
              localStorage.removeItem(`backup_${oldestBackupDate}`); // Limpia el backup viejo de localStorage
            }
          }

          // Guarda el historial actualizado y resetea la bandera de modificación.
          localStorage.setItem('sagaTracker_backupHistory', JSON.stringify(backupHistory));
          localStorage.setItem('libraryModified', 'false'); // Resetear la bandera de modificación
          UI.showToast('Copia de seguridad automática creada.', 'info');
        }
      }
    },

    toggleReadStatus: async function(id) {
      const bookIndex = this.books.findIndex(book => book.id === id);
      if (bookIndex !== -1) {
        const newReadStatus = !this.books[bookIndex].read;
        const newRating = newReadStatus ? this.books[bookIndex].rating : 0;

        const { error } = await supabase.from('books').update({ read: newReadStatus, rating: newRating }).eq('id', id);
        if (!error) {
          this.books[bookIndex].read = newReadStatus;
          this.books[bookIndex].rating = newRating;
          UI.renderBooks();
        } else {
          console.error('Error actualizando estado de lectura:', error);
        }
      }
    },

    setRating: async function(id, rating) {
      const bookIndex = this.books.findIndex(book => book.id === id);
      if (bookIndex !== -1) {
        const currentRating = this.books[bookIndex].rating;
        let newRating = rating;

        if (currentRating === rating) newRating = rating - 0.5; // Segundo clic: media estrella
        if (currentRating === rating - 0.5) newRating = 0; // Tercer clic: resetear

        const newRead = newRating > 0;
        const { error } = await supabase.from('books').update({ rating: newRating, read: newRead }).eq('id', id);
        if (!error) {
          this.books[bookIndex].rating = newRating;
          this.books[bookIndex].read = newRead;
          UI.renderBooks();
        } else {
          console.error('Error actualizando puntuación:', error);
        }
      }
    },

    saveEditedSaga: async function(form) {
        const newName = capitalizeWords(form.elements['saga-name'].value.trim());
        const newAuthor = capitalizeWords(form.elements['saga-author'].value.trim());
        const oldName = capitalizeWords(window._editingSagaName);
        if (newName && newName !== oldName) {
          this.books.forEach(b => {
            if (capitalizeWords(b.series) === oldName) b.series = newName;
          });
          // Actualizar en Supabase
          await supabase.from('books').update({ series: newName }).eq('series', oldName);
        }
        if (newAuthor) {
          this.books.forEach(b => {
            if (capitalizeWords(b.series) === (newName || oldName)) b.author = newAuthor;
          });
          // Actualizar en Supabase
          await supabase.from('books').update({ author: newAuthor }).eq('series', newName || oldName);
        }
        UI.renderBooks();
        ModalService.toggleModal('edit-saga-modal', false);
    },

    saveReorderedSaga: async function() {
      const sagaName = window._reorderSagaName;
      const list = document.getElementById('reorder-saga-list');
      const reorderedItems = Array.from(list.children);

      // Creamos un array de objetos para actualizar en Supabase.
      // Cada objeto tendrá el 'id' del libro y su nueva 'position'.
      const updates = reorderedItems.map((item, index) => ({
        id: parseInt(item.dataset.bookId),
        position: index // La nueva posición es simplemente el índice en la lista reordenada.
      }));

      // Actualizamos la base de datos con las nuevas posiciones.
      const { error } = await supabase.from('books').upsert(updates);

      if (error) {
        console.error('Error al guardar el nuevo orden:', error);
        UI.showToast('No se pudo guardar el nuevo orden.', 'error');
      } else {
        // Si se guardó bien, recargamos los libros para reflejar el orden de la DB.
        await this.loadBooks();
        UI.showToast('Orden de la saga guardado.', 'success');
      }

      UI.renderBooks();
      ModalService.toggleModal('reorder-saga-modal', false);
    },
  };

  const UI = {
    readStatusChart: null, // Referencia al gráfico de estado
    ratingsChart: null, // Referencia al gráfico de puntuaciones

    showToast: function(message, type = 'success') {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      
      const icons = {
        success: 'fa-check-circle',
        error: 'fa-times-circle',
        info: 'fa-info-circle'
      };
      
      const colors = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-blue-600'
      };
    
      toast.className = `flex items-center gap-3 p-4 rounded-lg shadow-lg text-white ${colors[type]} transform transition-all duration-300 translate-x-full opacity-0`;
      toast.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${message}</span>
      `;
      
      container.appendChild(toast);
    
      setTimeout(() => {
        toast.classList.remove('translate-x-full', 'opacity-0');
      }, 10);
    
      setTimeout(() => {
        toast.classList.add('opacity-0');
        toast.addEventListener('transitionend', () => toast.remove());
      }, 4000);
    },
    
    updateCoverSourceOptions: function() {
      const options = ['upload', 'api', 'url'];
      options.forEach(option => {
        const element = document.getElementById(`${option}-cover-option`);
        if (AppController.coverSource === option) {
          element.classList.remove('hidden');
        } else {
          element.classList.add('hidden');
        }
      });
      AppController.selectedCoverURL = null;
    },
    
    openNewBookModal: function() {
      document.getElementById('new-book-modal').classList.remove('hidden');
      document.getElementById('new-book-form').reset();
      document.getElementById('upload-preview').classList.add('hidden');
      document.getElementById('api-preview').classList.add('hidden');
      document.getElementById('url-preview').classList.add('hidden');
      document.getElementById('api-error').classList.add('hidden');
      document.getElementById('url-error').classList.add('hidden');
      
      // Reset cover source to default
      document.getElementById('api-cover').checked = true;
      AppController.coverSource = 'api';
      this.updateCoverSourceOptions();
    },
    
    closeNewBookModal: function() {
      ModalService.toggleModal('new-book-modal', false);
      // El reseteo del formulario ya se hace en openNewBookModal y al hacer submit.
    },

    saveNewBook: async function() {
      const form = document.getElementById('new-book-form');
      const title = capitalizeWords(form.querySelector('input[name="title"]').value.trim()) || 'Sin Título';
      const author = capitalizeWords(form.querySelector('input[name="author"]').value.trim()) || 'Sin Autor';
      const series = capitalizeWords(form.querySelector('input[name="series"]').value.trim()) || 'Sin saga';

      // Asegurarse de que la URL de la portada esté actualizada, especialmente si se usó la opción de URL manual.
      if (AppController.coverSource === 'url') {
        AppController.selectedCoverURL = document.getElementById('cover-url').value;
      }

      if (!AppController.selectedCoverURL) {
        // Default placeholder if no cover selected
        this.selectedCoverURL = 'https://cdn.pixabay.com/photo/2018/01/03/09/09/book-3057902_1280.png';
      }
      
      const book = {
        // id ya no es necesario, lo genera Supabase
        title,
        author,
        series,
        position: 0, // Por defecto, al crearlo. Podríamos mejorarlo para ponerlo al final.
        read: false, // Un libro nuevo siempre empieza como no leído
        cover: AppController.selectedCoverURL,
        rating: 0 // Nueva propiedad para la puntuación
      };
      
      await BookService.addBook(book);
      ModalService.toggleModal('new-book-modal', false);
      UI.renderBooks();
      this.showToast(`'${title}' ha sido añadido.`);
    },

    recommendRandomBook: function() {
      const unreadBooks = BookService.books.filter(book => !book.read);

      if (unreadBooks.length === 0) {
        this.showToast('¡Felicidades! Ya has leído todos tus libros.', 'info');
        return;
      }

      const randomIndex = Math.floor(Math.random() * unreadBooks.length);
      const recommendedBook = unreadBooks[randomIndex];

      ModalService.showConfirmation(
        `¿Qué tal si lees "${recommendedBook.title}" de la saga "${recommendedBook.series}"?`,
        () => {} // No hace nada al confirmar, solo cierra el modal
      );
    },
    
    updateStats: function() {
      const readBooks = BookService.books.filter(book => book.read);
      const ratedBooks = BookService.books.filter(book => book.rating > 0);

      const readCount = readBooks.length;

      // Calcular estadísticas de sagas
      const booksBySeries = BookService.books.reduce((acc, book) => {
        const seriesName = book.series || 'Sin saga';
        if (!acc[seriesName]) acc[seriesName] = [];
        acc[seriesName].push(book);
        return acc;
      }, {});

      const totalSagas = Object.keys(booksBySeries).length;
      let completedSagas = 0;
      for (const seriesName in booksBySeries) {
        const allRead = booksBySeries[seriesName].every(book => book.read);
        if (allRead) {
          completedSagas++;
        }
      }
      let avgRating = 0;

      if (ratedBooks.length > 0) {
        const totalRating = ratedBooks.reduce((sum, book) => sum + book.rating, 0);
        avgRating = (totalRating / ratedBooks.length).toFixed(1);
      }

      document.getElementById('total-sagas').textContent = totalSagas;
      document.getElementById('completed-sagas').textContent = completedSagas;
      document.getElementById('read-count').textContent = readCount;
      document.getElementById('avg-rating').textContent = avgRating;
    },

    // --- INICIO DE SECCIÓN DE REFACTORIZACIÓN de renderBooks ---

    getFilteredAndSortedBooks: function() {
      let filteredBooks = [...BookService.books];
      if (AppController.seriesFilter) {
        const filter = AppController.seriesFilter.toLowerCase().trim();
        
        if (filter.startsWith('titulo:')) {
            const searchTerm = filter.substring(7).trim();
            filteredBooks = filteredBooks.filter(book => book.title.toLowerCase().includes(searchTerm));
        } else if (filter.startsWith('autor:')) {
            const searchTerm = filter.substring(6).trim();
            filteredBooks = filteredBooks.filter(book => book.author.toLowerCase().includes(searchTerm));
        } else if (filter.startsWith('saga:')) {
            const searchTerm = filter.substring(5).trim();
            filteredBooks = filteredBooks.filter(book => book.series.toLowerCase().includes(searchTerm));
        } else {
            // Comportamiento de búsqueda general si no hay prefijo
            filteredBooks = filteredBooks.filter(book =>
              book.series.toLowerCase().includes(filter) ||
              book.title.toLowerCase().includes(filter) ||
              book.author.toLowerCase().includes(filter)
            );
        }
      }
      return filteredBooks;
    },

    groupAndSortSagas: function(books) {
      const booksBySeries = books.reduce((acc, book) => {
        // Usamos una clave normalizada (en minúsculas) para agrupar,
        // pero mantenemos el nombre original capitalizado para mostrarlo.
        const normalizedSeriesName = (book.series || 'Sin saga').toLowerCase();
        const displaySeriesName = book.series || 'Sin saga';

        if (!acc[normalizedSeriesName]) {
          acc[normalizedSeriesName] = { books: [], displayName: displaySeriesName };
        }
        acc[normalizedSeriesName].books.push(book);
        return acc;
      }, {});

      // Ordenar libros dentro de cada saga
      // Ya no se ordenan los libros dentro de la saga, se respeta el orden de entrada.

      const sortedSeriesNames = Object.keys(booksBySeries).sort((a, b) => {
        if (a === 'sin saga') return 1; // Usamos la clave normalizada
        if (b === 'sin saga') return -1;
        return a.localeCompare(b);
      });

      sortedSeriesNames.sort((a, b) => {
        // Ordenar por nombre de autor (no apellido)
        if (AppController.currentSort === 'author') {
          return (booksBySeries[a].books[0]?.author || '').localeCompare(booksBySeries[b].books[0]?.author || '');
        }
        return a.localeCompare(b); // Default to series name sort
      });

      return { booksBySeries, sortedSeriesNames };
    },

    createBookCard: function(book, index) { // Añadimos el índice como parámetro
      const card = document.createElement('div');
      card.className = 'book-card-container flex flex-col items-center';
      card.draggable = true;
      card.dataset.bookId = book.id;
      card.dataset.index = index; // Guardamos el índice original para el drag and drop
      const readIconClass = book.read ? 'fas fa-check-circle text-green-500' : 'far fa-circle text-gray-400';
      const starsHTML = [1, 2, 3, 4, 5].map(i => `
        <span class="star ${book.rating >= i ? 'filled' : (book.rating >= i - 0.5 ? 'half-filled' : '')}" data-value="${i}">
          ${book.rating >= i ? '<i class="fas fa-star"></i>' : (book.rating >= i - 0.5 ? '<i class="fas fa-star-half-alt"></i>' : '<i class="far fa-star text-gray-500"></i>')}
        </span>
      `).join('');

      card.innerHTML = `
        <div class="book-card relative" style="aspect-ratio: 2/3;">
          <img src="${book.cover}" alt="Portada de ${book.title}" class="book-cover w-full h-full">
          ${!book.read ? '<div class="unread-overlay rounded-lg"></div>' : ''}
          <div class="absolute top-2 right-2">
            <span class="toggle-read cursor-pointer" data-action="toggle-read"><i class="${readIconClass} text-xl"></i></span>
          </div>
        </div>
        <div class="book-info pt-3 text-center w-full">
          <h3 class="font-semibold text-sm truncate mb-1" title="${book.title}">${book.title}</h3>
          <div class="stars flex justify-center" data-action="rate" title="Puntuar libro">
          ${starsHTML}
          </div>
        </div>
      `;
      return card;
    },

    createSeriesSection: function(seriesName, booksInSeries) {
      const seriesSection = document.createElement('div');
      seriesSection.className = 'mb-12';
      seriesSection.dataset.seriesName = seriesName;

      const author = booksInSeries.length > 0 ? capitalizeWords(booksInSeries[0].author) : '';
      const ratedBooksInSeries = booksInSeries.filter(b => b.rating > 0);
      let avgRatingText = 'Sin puntuar';
      if (ratedBooksInSeries.length > 0) {
        const totalRating = ratedBooksInSeries.reduce((sum, book) => sum + book.rating, 0);
        avgRatingText = (totalRating / ratedBooksInSeries.length).toFixed(1) + ' ★';
      }

      const titleText = `${capitalizeWords(seriesName)} | ${author} | ${avgRatingText}`;

      seriesSection.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <h2 class="shelf-title border-b border-gray-700 pb-2 flex-1">${titleText}</h2>
          <div class="relative">
            <button class="saga-menu-btn text-xl text-gray-400 hover:text-purple-400 p-2 rounded-full" data-action="toggle-saga-menu" title="Opciones de saga">
              <i class="fas fa-ellipsis-v"></i>
            </button>
            <div class="saga-menu-content absolute right-0 mt-2 bg-gray-900 border border-gray-700 rounded-lg shadow-lg z-50 hidden min-w-[160px]">
              <button data-action="add-to-saga" class="w-full text-left px-4 py-2 hover:bg-green-700 text-white"><i class="fas fa-plus mr-2"></i>Añadir</button>
              <button data-action="reorder-saga" class="w-full text-left px-4 py-2 hover:bg-purple-700 text-white"><i class="fas fa-list-ol mr-2"></i>Reordenar</button>
              <button data-action="edit-saga" class="w-full text-left px-4 py-2 hover:bg-blue-700 text-white"><i class="fas fa-edit mr-2"></i>Editar saga</button>
              <button data-action="edit-book" class="w-full text-left px-4 py-2 hover:bg-blue-700 text-white"><i class="fas fa-pen-to-square mr-2"></i>Editar libro</button>
              <button data-action="delete-book" class="w-full text-left px-4 py-2 hover:bg-red-700 text-red-400"><i class="fas fa-minus-circle mr-2"></i>Eliminar libro</button>
              <button data-action="delete-saga" class="w-full text-left px-4 py-2 hover:bg-red-700 text-red-400"><i class="fas fa-trash mr-2"></i>Eliminar saga</button>
            </div>
          </div>
        </div>
      `;

      const seriesGrid = document.createElement('div');
      seriesGrid.className = 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-4';

      booksInSeries.forEach((book, index) => {
        const card = this.createBookCard(book, index);
        seriesGrid.appendChild(card);
      });

      seriesSection.appendChild(seriesGrid);
      return seriesSection;
    },

    renderEmptyMessage: function(grid) {
      const message = BookService.books.length === 0 ?
        `<div class="text-center col-span-full text-gray-500 py-12">
          <i class="fas fa-book-open text-5xl mb-4"></i>
          <p class="text-xl">No hay libros en tu biblioteca</p>
          <p class="mt-2">Haz clic en "Nuevo Libro" para agregar tu primera entrada</p>
        </div>` :
        `<div class="text-center col-span-full text-gray-500 py-12">
          <i class="fas fa-filter text-5xl mb-4"></i>
          <p class="text-xl">No hay libros que coincidan con los filtros actuales</p>
        </div>`;
      grid.innerHTML = message;
    },

    renderBooks: function() {
      console.log('Renderizando libros...');
      const grid = document.getElementById('book-grid');
      grid.innerHTML = '';
      this.updateStats();

      const filteredBooks = this.getFilteredAndSortedBooks();
      const { booksBySeries, sortedSeriesNames } = this.groupAndSortSagas(filteredBooks);

      if (sortedSeriesNames.length === 0) {
        this.renderEmptyMessage(grid);
        return;
      }

      sortedSeriesNames.forEach(seriesName => {
        const sagaData = booksBySeries[seriesName];
        const seriesSection = this.createSeriesSection(sagaData.displayName, sagaData.books);
        grid.appendChild(seriesSection);
      });
    },

    openStatsModal: function() {
      this.toggleModal('stats-modal', true);
      // Usamos un pequeño retraso para asegurar que el modal es visible antes de dibujar
      setTimeout(() => {
        this.renderStatsCharts();
      }, 100);
    },

    renderStatsCharts: function() {
      // --- Gráfico de Estado de Lectura (Torta) ---
      const readCount = BookService.books.filter(b => b.read).length;
      const unreadCount = BookService.books.length - readCount;

      const readStatusCtx = document.getElementById('read-status-chart').getContext('2d');
      if (this.readStatusChart) this.readStatusChart.destroy(); // Destruir gráfico anterior
      this.readStatusChart = new Chart(readStatusCtx, {
        type: 'doughnut',
        data: {
          labels: ['Leídos', 'No Leídos'],
          datasets: [{
            data: [readCount, unreadCount],
            backgroundColor: ['#a855f7', '#4b5563'], // Morado y Gris
            borderColor: '#1e1e1e',
            borderWidth: 4
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'top', labels: { color: '#e0e0e0' } },
            title: { display: true, text: 'Estado de Lectura', color: '#e0e0e0', font: { size: 16 } }
          }
        }
      });

      // --- Gráfico de Puntuaciones (Barras) ---
      const ratings = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
      const ratingsCount = ratings.map(r => BookService.books.filter(b => b.rating === r).length);

      const ratingsCtx = document.getElementById('ratings-chart').getContext('2d');
      if (this.ratingsChart) this.ratingsChart.destroy(); // Destruir gráfico anterior
      this.ratingsChart = new Chart(ratingsCtx, {
        type: 'bar',
        data: {
          labels: ratings.map(String),
          datasets: [{
            label: 'Número de Libros',
            data: ratingsCount,
            backgroundColor: '#f59e0b', // Ámbar
            borderColor: '#ca8a04',
            borderWidth: 1
          }]
        },
        options: {
          indexAxis: 'y', // Hace el gráfico de barras horizontal
          scales: { y: { ticks: { color: '#e0e0e0' } }, x: { ticks: { color: '#e0e0e0' } } },
          plugins: { legend: { display: false }, title: { display: true, text: 'Distribución de Puntuaciones', color: '#e0e0e0', font: { size: 16 } } }
        }
      });
    },
  };

  const ModalService = {
    toggleModal: (modalId, show = true) => document.getElementById(modalId)?.classList.toggle('hidden', !show),

    closeAllMenus: function(exceptThisOne) {
      document.querySelectorAll('.saga-menu-content').forEach(menu => {
        if (menu !== exceptThisOne) {
          menu.classList.remove('show');
          menu.classList.add('hidden');
        }
      });
      const settingsDropdown = document.getElementById('settings-dropdown');
      if (settingsDropdown && settingsDropdown !== exceptThisOne) {
        settingsDropdown.style.display = 'none';
      }
    },

    showConfirmation: function(message, onConfirm, validationText = null, inputLabel = '') {
        const modal = document.getElementById('confirmation-modal');
        const inputContainer = document.getElementById('confirmation-input-container');
        const inputField = document.getElementById('confirmation-input');
        const inputLabelElement = document.getElementById('confirmation-input-label');

        document.getElementById('confirmation-message').textContent = message;
        modal.classList.remove('hidden');

        if (validationText) {
          inputContainer.classList.remove('hidden');
          inputLabelElement.textContent = inputLabel;
          inputField.value = '';
        } else {
          inputContainer.classList.add('hidden');
        }

        // Clone and replace the button to remove old event listeners
        const oldBtn = document.getElementById('confirm-ok-btn');
        const newBtn = oldBtn.cloneNode(true);
        oldBtn.parentNode.replaceChild(newBtn, oldBtn);

        newBtn.onclick = () => {
          if (validationText && inputField.value !== validationText) {
            UI.showToast('El texto de confirmación es incorrecto.', 'error');
            return;
          }
          onConfirm();
          this.closeConfirmationModal();
        };
    },

    handleGridClick: function(e) {
      const target = e.target;
      const actionElement = target.closest('[data-action]');
      if (!actionElement) return;

      const action = actionElement.dataset.action;
      const bookCardContainer = target.closest('.book-card-container');
      const seriesSection = target.closest('[data-series-name]');
      const seriesName = seriesSection?.dataset.seriesName;

      switch (action) {
        case 'toggle-saga-menu':
          e.stopPropagation();
          const menuContent = actionElement.nextElementSibling;
          const isVisible = !menuContent.classList.contains('hidden');
          ModalService.closeAllMenus(); // Cierra todos los demás menús
          if (!isVisible) {
            menuContent.classList.remove('hidden');
            menuContent.classList.add('show');
          }
          break;
        case 'add-to-saga':
          ModalService.closeAllMenus();
          ModalService.openAddBookToSagaModal(seriesName);
          break;
        case 'reorder-saga':
          ModalService.closeAllMenus();
          ModalService.openReorderModal(seriesName);
          break;
        case 'edit-saga':
          ModalService.closeAllMenus();
          ModalService.openEditSagaModal(seriesName);
          break;
        case 'edit-book':
          ModalService.closeAllMenus();
          ModalService.openReorderModal(seriesName, 'edit'); // Reutilizamos el modal de reordenar para seleccionar
          break;
        case 'delete-book':
          ModalService.closeAllMenus();
          ModalService.openReorderModal(seriesName, 'delete'); // Reutilizamos el modal de reordenar para seleccionar
          break;
        case 'delete-saga':
          ModalService.closeAllMenus();
          ModalService.showConfirmation(`¿Seguro que quieres eliminar la saga "${seriesName}" y todos sus libros?`, () => {
            BookService.books = BookService.books.filter(b => b.series !== seriesName);
            BookService.saveBooks();
            UI.renderBooks();
          });
          break;
        case 'toggle-read':
          const bookIdToToggle = parseInt(bookCardContainer.dataset.bookId);
          BookService.toggleReadStatus(bookIdToToggle);
          break;
        case 'rate':
          const star = target.closest('.star');
          if (star) {
            const bookIdToRate = parseInt(bookCardContainer.dataset.bookId);
            const rating = parseInt(star.dataset.value);
            BookService.setRating(bookIdToRate, rating);
          }
          break;
      }
    },
    
    openAddBookToSagaModal: function(seriesName) {
      const form = document.getElementById('add-book-to-saga-form');
      const author = BookService.books.find(b => b.series === seriesName)?.author || '';
      form.reset();
      // Resetear UI de búsqueda de portada
      document.getElementById('add-to-saga-api-preview').classList.add('hidden');
      document.getElementById('add-to-saga-api-error').classList.add('hidden');
      AppController.selectedCoverURL = null;

      // Rellenar datos
      form.elements['saga-name'].value = seriesName;
      form.elements['author-name'].value = author;
      document.getElementById('add-to-saga-name-display').textContent = seriesName;
      document.getElementById('add-to-saga-author-display').textContent = author;

      ModalService.toggleModal('add-book-to-saga-modal', true);
    },

    openReorderModal: function(seriesName, mode = 'reorder') {
      const sagaBooks = BookService.books.filter(b => b.series === seriesName);
      const list = document.getElementById('reorder-saga-list');
      const modalTitle = document.querySelector('#reorder-saga-modal h2');
      const saveButton = document.getElementById('save-reorder-saga-btn');

      list.innerHTML = '';
      sagaBooks.forEach((book, idx) => {
        const item = document.createElement('div');
        item.className = 'flex items-center gap-2 bg-gray-800 rounded px-3 py-2 cursor-move';
        item.dataset.bookId = book.id;
        
        if (mode === 'reorder') {
          item.draggable = true;
          item.innerHTML = `<i class="fas fa-grip-vertical text-gray-500 mr-2"></i><span class="flex-1">${book.title}</span>`;
          
          // Eventos de Drag and Drop
          item.addEventListener('dragstart', () => item.classList.add('opacity-50'));
          item.addEventListener('dragend', () => item.classList.remove('opacity-50'));
          item.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingItem = document.querySelector('#reorder-saga-list .opacity-50');
            if (draggingItem && draggingItem !== item) {
              const rect = item.getBoundingClientRect();
              const offsetY = e.clientY - rect.top - (rect.height / 2);
              if (offsetY < 0) {
                list.insertBefore(draggingItem, item);
              } else {
                list.insertBefore(draggingItem, item.nextSibling);
              }
            }
          });

        } else if (mode === 'edit') {
          item.innerHTML = `<span class="flex-1">${book.title}</span><button class="edit-book-saga px-2 py-1 bg-blue-700 rounded text-xs text-white">Editar</button>`;
        } else if (mode === 'delete') {
          item.innerHTML = `<span class="flex-1">${book.title}</span><button class="delete-book-saga px-2 py-1 bg-red-700 rounded text-xs text-white">Eliminar</button>`;
        }

        list.appendChild(item);
      });
      ModalService.toggleModal('reorder-saga-modal', true);
      window._reorderSagaName = seriesName;
    },

    openEditBookModal: function(bookId) {
      const book = BookService.books.find(b => b.id === bookId);
      if (!book) return;

      const form = document.getElementById('edit-book-form');
      form.elements['book-id'].value = book.id;
      form.elements['title'].value = book.title;
      form.elements['author'].value = book.author;
      form.elements['series'].value = book.series;

      document.getElementById('edit-cover-preview').src = book.cover;
      document.getElementById('edit-api-error').classList.add('hidden');
      AppController.selectedCoverURL = null;
      ModalService.toggleModal('edit-book-modal', true);
    },

    openEditSagaModal: function(sagaName) {
      const booksInSaga = BookService.books.filter(b => b.series === sagaName);
      const currentAuthor = booksInSaga[0]?.author || '';
      const form = document.getElementById('edit-saga-form');
      form.elements['saga-name'].value = sagaName;
      form.elements['saga-author'].value = currentAuthor;
      ModalService.toggleModal('edit-saga-modal', true);
      window._editingSagaName = sagaName;
    },

    handleReorderListClick: function(e) {
      const target = e.target;
      const item = target.parentElement;
      const bookId = parseInt(item.dataset.bookId);
      const book = BookService.books.find(b => b.id === bookId);
      if (target.classList.contains('edit-book-saga')) {
        ModalService.openEditBookModal(book.id);
        ModalService.toggleModal('reorder-saga-modal', false); // Cierra el modal de reordenar
      } else if (target.classList.contains('delete-book-saga')) {
        window._deleteBookSagaId = book.id;
        document.getElementById('delete-book-message').textContent = `¿Seguro que quieres eliminar "${book.title}" de la saga?`;
        ModalService.toggleModal('reorder-saga-modal', false); // Cierra el modal de reordenar
        ModalService.toggleModal('delete-book-modal-saga', true); // Abre el modal de confirmación
      }
    },

    closeConfirmationModal: function() {
        this.toggleModal('confirmation-modal', false);
    },

    openRestoreBackupModal: function() {
      const backupHistory = JSON.parse(localStorage.getItem('sagaTracker_backupHistory') || '[]');
      const backupListContainer = document.getElementById('backup-list');
      backupListContainer.innerHTML = '';

      if (backupHistory.length === 0) {
        backupListContainer.innerHTML = '<p class="text-gray-500 text-center">No hay copias de seguridad automáticas disponibles.</p>';
      } else {
        // Mostrar del más reciente al más antiguo
        backupHistory.slice().reverse().forEach(date => {
          const backupItem = document.createElement('div');
          backupItem.className = 'flex justify-between items-center bg-gray-800 p-3 rounded-md';
          backupItem.innerHTML = `
            <span>Copia del ${date}</span>
            <button data-date="${date}" class="restore-btn px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm">Restaurar</button>
          `;
          backupListContainer.appendChild(backupItem);
        });
      }

      ModalService.toggleModal('restore-backup-modal', true);
    },

    handleRestoreBackupClick: function(e) {
      if (e.target.classList.contains('restore-btn')) {
        const date = e.target.dataset.date;
        ModalService.showConfirmation(`¿Seguro que quieres restaurar la copia del ${date}? Se perderán todos los datos actuales.`, () => {
          const csvContent = localStorage.getItem(`backup_${date}`);
          if (csvContent) {
            // El contenido guardado incluye "data:text/csv;charset=utf-8,", lo quitamos.
            const cleanCsv = csvContent.substring(csvContent.indexOf(',') + 1);
            BookService.importFromCSV(decodeURI(cleanCsv));
            ModalService.toggleModal('restore-backup-modal', false);
          } else {
            UI.showToast('No se encontró el archivo de backup para esa fecha.', 'error');
          }
        });
      }
    },
  };

  const AppController = {
    currentSort: 'series', // Default sort
    seriesFilter: '',
    coverSource: 'upload',
    selectedCoverURL: null,
    debounceTimer: null, // Para el debounce del filtro de saga

    init: function() {
      this.bindEvents();
      BookService.loadBooks(); // Carga inicial desde localStorage
      UI.renderBooks(); // Renderiza los libros locales al arrancar
      BookService.setupAutoBackup();
    },

    bindEvents: function() {
      // New book button
      document.getElementById('new-book-btn').addEventListener('click', () => UI.openNewBookModal());

      // Random book button
      document.getElementById('random-book-btn').addEventListener('click', () => UI.recommendRandomBook());
      
      // Settings menu button
      document.getElementById('settings-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        document.getElementById('settings-dropdown').style.display = 'block';
      });

      // Restore backup button
      document.getElementById('restore-backup-btn').addEventListener('click', () => ModalService.openRestoreBackupModal());

      // Restore backup modal
      document.getElementById('close-restore-backup-modal').addEventListener('click', () => ModalService.toggleModal('restore-backup-modal', false));
      document.getElementById('backup-list').addEventListener('click', (e) => ModalService.handleRestoreBackupClick(e));

      // --- Event Listeners para Modales (centralizados) ---

      // Modal Eliminar Libro (desde Saga)
      document.getElementById('cancel-delete-book-saga-btn').addEventListener('click', () => ModalService.toggleModal('delete-book-modal-saga', false));
      document.getElementById('confirm-delete-book-saga-btn').addEventListener('click', () => {
        const bookIdToDelete = window._deleteBookSagaId;
        // BookService.books = BookService.books.filter(b => b.id !== bookId);
        // BookService.saveBooks();
        BookService.deleteBook(bookIdToDelete);
        UI.renderBooks();
        ModalService.toggleModal('delete-book-modal-saga', false);
      });

      // Modal Reordenar Saga
      document.getElementById('close-reorder-saga-modal').addEventListener('click', () => ModalService.toggleModal('reorder-saga-modal', false));
      document.getElementById('cancel-reorder-saga-btn').addEventListener('click', () => ModalService.toggleModal('reorder-saga-modal', false));
      document.getElementById('reorder-saga-list').addEventListener('click', (e) => ModalService.handleReorderListClick(e));
      document.getElementById('save-reorder-saga-btn').addEventListener('click', () => BookService.saveReorderedSaga());

      // Modal Editar Saga
      document.getElementById('close-edit-saga-modal').addEventListener('click', () => ModalService.toggleModal('edit-saga-modal', false));
      document.getElementById('cancel-edit-saga-btn').addEventListener('click', () => ModalService.toggleModal('edit-saga-modal', false));
      document.getElementById('edit-saga-form').addEventListener('submit', (e) => {
        e.preventDefault();
        BookService.saveEditedSaga(e.target);
      });

      // Modal de Estadísticas
      document.getElementById('close-stats-modal').addEventListener('click', () => ModalService.toggleModal('stats-modal', false));
      document.getElementById('stats-section').addEventListener('click', () => UI.openStatsModal());

      // Modal Añadir Libro a Saga
      document.getElementById('close-add-to-saga-modal').addEventListener('click', () => ModalService.toggleModal('add-book-to-saga-modal', false));
      document.getElementById('cancel-add-to-saga-btn').addEventListener('click', () => ModalService.toggleModal('add-book-to-saga-modal', false));
      document.getElementById('add-book-to-saga-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const title = capitalizeWords(form.elements['title'].value.trim());
        const series = capitalizeWords(form.elements['saga-name'].value);
        const author = form.elements['author-name'].value;
        let coverURL = this.selectedCoverURL || 'https://cdn.pixabay.com/photo/2018/01/03/09/09/book-3057902_1280.png';

        if (title && series && author) {
          const newBook = { id: Date.now(), title, author, series, read: false, rating: 0, cover: coverURL };
          await BookService.addBook(newBook);
          UI.renderBooks();
          UI.showToast(`'${title}' añadido a la saga.`);
        }
        ModalService.toggleModal('add-book-to-saga-modal', false);
      });

      document.getElementById('add-to-saga-fetch-cover-btn').addEventListener('click', () => {
        const form = document.getElementById('add-book-to-saga-form');
        const title = form.elements['title'].value;
        const author = form.elements['author-name'].value;
        const series = form.elements['saga-name'].value;

        if (!title) {
          UI.showToast('Por favor, ingresa un título para buscar.', 'info');
          return;
        }

        form.style.pointerEvents = 'none';
        const spinner = document.getElementById('add-to-saga-api-spinner');
        const errorDiv = document.getElementById('add-to-saga-api-error');
        const previewDiv = document.getElementById('add-to-saga-api-preview');
        BookService.findCoverAndUpdateUI({ title, author, series }, spinner, errorDiv, previewDiv.querySelector('img'), form);
      });

      // Delegación de eventos para la rejilla de libros
      document.getElementById('book-grid').addEventListener('click', (e) => {
        ModalService.handleGridClick(e);
      });

      // Eventos de Drag and Drop para reordenar libros
      document.getElementById('book-grid').addEventListener('dragstart', (e) => this.handleDragStart(e));
      document.getElementById('book-grid').addEventListener('dragover', (e) => this.handleDragOver(e));
      document.getElementById('book-grid').addEventListener('drop', (e) => this.handleDrop(e));

      // --- Fin de Event Listeners para Modales ---

      // Close modal buttons
      document.getElementById('close-modal').addEventListener('click', () => UI.closeNewBookModal());
      document.getElementById('cancel-btn').addEventListener('click', () => UI.closeNewBookModal());

      // Confirmation modal buttons
      document.getElementById('confirm-cancel-btn').addEventListener('click', () => ModalService.closeConfirmationModal());
      document.getElementById('confirmation-modal').querySelector('.modal-overlay').addEventListener('click', () => ModalService.closeConfirmationModal());

      
      // Modal overlay click to close
      document.querySelector('.modal-overlay').addEventListener('click', () => UI.closeNewBookModal());
      
      document.getElementById('series-filter').addEventListener('input', (e) => {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.seriesFilter = e.target.value.trim().toLowerCase();
          UI.renderBooks();
        }, 300); // Espera 300ms después de que dejes de escribir
      });
      
      // Sort buttons
      document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const sortBy = e.target.dataset.sort;
          this.currentSort = sortBy;
          localStorage.setItem('sagaTracker_sort', this.currentSort); // Guardar orden
          
          // Update active button style
          document.querySelectorAll('.sort-btn').forEach(b => {
            b.classList.remove('bg-purple-600', 'text-white');
            b.classList.add('hover:bg-gray-600');
          });
          e.target.classList.add('bg-purple-600', 'text-white');
          e.target.classList.remove('hover:bg-gray-600');
          
          UI.renderBooks();
        });
      });
      
      // Cover source radio buttons
      document.querySelectorAll('input[name="cover-source"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          this.coverSource = e.target.value;
          UI.updateCoverSourceOptions();
        });
      });
      
      // File upload preview
      document.getElementById('cover-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            document.getElementById('cover-preview').src = e.target.result;
            document.getElementById('upload-preview').classList.remove('hidden');
            this.selectedCoverURL = e.target.result;
          };
          reader.readAsDataURL(file);
        }
      });
      
      // Fetch cover button
      document.getElementById('fetch-cover-btn').addEventListener('click', () => {
        const form = document.getElementById('new-book-form');
        const title = form.querySelector('input[name="title"]').value;
        const author = form.querySelector('input[name="author"]').value;
        const series = form.querySelector('input[name="series"]').value;
        
        if (!title || !author) {
          UI.showToast('Ingresa título y autor para buscar.', 'info');
          return;
        }
        form.style.pointerEvents = 'none'; // Deshabilita interacciones
        
        // Show spinner
        document.getElementById('api-error').classList.add('hidden');
        document.getElementById('api-spinner').classList.remove('hidden');
        document.getElementById('fetch-cover-btn').disabled = true; // Desactivar botón
        
        BookService.findCoverAndUpdateUI({ title, author, series }, document.getElementById('api-spinner'), document.getElementById('api-error'), document.getElementById('api-cover-preview'), form);
      });
      
      // Validate URL button
      document.getElementById('validate-url-btn').addEventListener('click', () => {
        const url = document.getElementById('cover-url').value;
        if (!url) {
          alert('Por favor ingresa una URL de imagen');
          return;
        }
        
        // Show spinner
        document.getElementById('url-spinner').classList.remove('hidden');
        
        // Load and validate the image
        const img = new Image();
        img.onload = () => {
          document.getElementById('url-cover-preview').src = url;
          document.getElementById('url-preview').classList.remove('hidden');
          document.getElementById('url-error').classList.add('hidden');
          document.getElementById('url-spinner').classList.add('hidden');
          this.selectedCoverURL = url;
        };
        img.onerror = () => {
          document.getElementById('url-error').classList.remove('hidden');
          document.getElementById('url-preview').classList.add('hidden');
          document.getElementById('url-spinner').classList.add('hidden');
          this.selectedCoverURL = null;
        };
        img.src = url;
      });
      
      // Submit form
      document.getElementById('new-book-form').addEventListener('submit', (e) => {
        e.preventDefault();
        UI.saveNewBook();
      });

      // --- Autocomplete Setup ---
      BookService.setupAutocomplete(
        '#new-book-form input[name="series"]',
        '#new-book-form .saga-autocomplete-list',
        () => [...new Set(BookService.books.map(b => b.series).filter(s => s && s !== 'Sin saga'))]
      );
      BookService.setupAutocomplete(
        '#new-book-form input[name="author"]',
        '#new-book-form .author-autocomplete-list',
        () => [...new Set(BookService.books.map(b => b.author).filter(Boolean))]
      );
      BookService.setupAutocomplete(
        '#edit-book-form input[name="series"]',
        '#edit-book-form .saga-autocomplete-list',
        () => [...new Set(BookService.books.map(b => b.series).filter(s => s && s !== 'Sin saga'))]
      );
      BookService.setupAutocomplete(
        '#edit-book-form input[name="author"]',
        '#edit-book-form .author-autocomplete-list',
        () => [...new Set(BookService.books.map(b => b.author).filter(Boolean))]
      );

      // Submit EDIT form
      document.getElementById('edit-book-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const form = e.target;
        const bookId = parseInt(form.elements['book-id'].value);
        const bookIndex = BookService.books.findIndex(b => b.id === bookId);
        if (bookIndex !== -1) {
          const updatedBook = {
            title: capitalizeWords(form.elements['title'].value),
            author: capitalizeWords(form.elements['author'].value.trim()),
            series: capitalizeWords(form.elements['series'].value.trim()) || 'Sin saga',
            cover: this.selectedCoverURL || BookService.books[bookIndex].cover
          };
          // Si se encontró una nueva portada, se actualiza. Si no, se mantiene la original.
          const { error } = await supabase.from('books').update(updatedBook).eq('id', bookId);
          if (error) console.error('Error actualizando libro:', error);
          else Object.assign(BookService.books[bookIndex], updatedBook);

          UI.renderBooks();
          UI.showToast('Libro actualizado correctamente.');
        }
        ModalService.toggleModal('edit-book-modal', false);
      });

      document.getElementById('edit-fetch-cover-btn').addEventListener('click', () => {
        const form = document.getElementById('edit-book-form');
        const title = form.elements['title'].value;
        const author = form.elements['author'].value;
        const series = form.elements['series'].value;

        if (!title || !author) {
          UI.showToast('El título y el autor son necesarios para buscar.', 'info');
          return;
        }

        const spinner = document.getElementById('edit-api-spinner');
        const errorDiv = document.getElementById('edit-api-error');
        const previewImg = document.getElementById('edit-cover-preview');

        spinner.classList.remove('hidden');
        errorDiv.classList.add('hidden');

        const findCover = (query) => {
          return fetch(`https://openlibrary.org/search.json?q=${query}`)
            .then(response => response.json())
            .then(data => data.docs.slice(0, 10).find(doc => doc.cover_i && doc.author_name));
        };

        const specificQuery = `${title} ${author} ${series}`.trim().split(' ').join('+');
        findCover(specificQuery)
          .then(bookWithCover => {
            if (bookWithCover) return bookWithCover;
            const generalQuery = `${title} ${author}`.trim().split(' ').join('+');
            return findCover(generalQuery);
          })
          .then(bookWithCover => {
            if (bookWithCover) {
              const coverURL = `https://covers.openlibrary.org/b/id/${bookWithCover.cover_i}-L.jpg`;
              previewImg.src = coverURL; // Actualiza la vista previa
              this.selectedCoverURL = coverURL; // Guarda la nueva URL para usarla al guardar
            } else {
              errorDiv.classList.remove('hidden');
              this.selectedCoverURL = null;
            }
          })
          .catch(err => console.error('Error buscando portada en edición:', err))
          .finally(() => spinner.classList.add('hidden'));
      });
      document.getElementById('close-edit-book-modal').addEventListener('click', () => ModalService.toggleModal('edit-book-modal', false));
      document.getElementById('cancel-edit-book-btn').addEventListener('click', () => ModalService.toggleModal('edit-book-modal', false));
      
      // Reset library button
      document.getElementById('reset-library').addEventListener('click', () => {
        ModalService.showConfirmation(
          'Esta acción borrará TODOS los libros de la base de datos. Para confirmar, escribe tu fecha de cumpleaños (DDMMAAAA).',
          async () => {
            // Borra todos los libros de la tabla
            await supabase.from('books').delete().neq('id', 0); // Borra todas las filas
            BookService.books = [];
            UI.renderBooks();
            UI.showToast('Biblioteca reiniciada.', 'info');
          }, '28042006', 'Escribe 28042006 para confirmar');
      })
      // Export to CSV button
      document.getElementById('export-csv').addEventListener('click', () => {
        if (BookService.books.length === 0) return UI.showToast('La biblioteca está vacía.', 'info');
        BookService.exportToCSV();
      });

      // Import from CSV button
      document.getElementById('import-csv-btn').addEventListener('click', () => {
        document.getElementById('csv-file-input').click();
      });

      document.getElementById('csv-file-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        ModalService.showConfirmation('¿Estás seguro de que quieres importar este archivo? Se borrará toda tu biblioteca actual.', () => {
            BookService.importFromCSV(file);
        });
      });
    },

    handleDragStart: function(e) {
      const card = e.target.closest('.book-card-container');
      if (!card) return;
      
      // Añadimos una clase para dar feedback visual
      card.classList.add('opacity-50');
      
      // Guardamos el ID del libro que se está arrastrando
      e.dataTransfer.setData('text/plain', card.dataset.bookId);
      e.dataTransfer.effectAllowed = 'move';
    },

    handleDragOver: function(e) {
      e.preventDefault(); // Necesario para permitir el 'drop'
      const targetCard = e.target.closest('.book-card-container');
      if (targetCard) {
        // Opcional: añadir un indicador visual sobre dónde se soltará
      }
    },

    handleDrop: function(e) {
      e.preventDefault();
      const draggedBookId = parseInt(e.dataTransfer.getData('text/plain'));
      const targetCard = e.target.closest('.book-card-container');
      
      // Quitar el feedback visual del elemento arrastrado
      const draggedElement = document.querySelector(`[data-book-id="${draggedBookId}"]`);
      if (draggedElement) draggedElement.classList.remove('opacity-50');

      if (!targetCard || parseInt(targetCard.dataset.bookId) === draggedBookId) return;

      const draggedBook = BookService.books.find(b => b.id === draggedBookId);
      const targetBook = BookService.books.find(b => b.id === parseInt(targetCard.dataset.bookId));

      // --- MEJORA: Solo permitir reordenar dentro de la misma saga ---
      if (!draggedBook || !targetBook || draggedBook.series !== targetBook.series) {
        UI.showToast('Solo puedes reordenar libros dentro de la misma saga.', 'info');
        return;
      }

      const fromIndex = BookService.books.indexOf(draggedBook);
      const toIndex = BookService.books.indexOf(targetBook);

      if (fromIndex !== -1 && toIndex !== -1) {
        const [movedBook] = BookService.books.splice(fromIndex, 1); // Mover el libro en el array
        BookService.books.splice(toIndex, 0, movedBook);
        UI.renderBooks(); // Volver a renderizar para mostrar el nuevo orden
      }
    },
  };

  // Close dropdown if clicking outside
  window.addEventListener('click', function(e) {
    // Si el clic no fue en un botón de menú, cierra todos los menús.
    if (!e.target.closest('[data-action="toggle-saga-menu"]')) {
      ModalService.closeAllMenus();
    }

    // Close settings dropdown if clicking outside
    const settingsDropdown = document.getElementById('settings-dropdown');
    if (settingsDropdown && !settingsDropdown.parentElement.contains(e.target)) {
      settingsDropdown.style.display = 'none';
    }

    // Close autocomplete if clicking outside
    const sagaAutocomplete = document.getElementById('saga-autocomplete-list');
    if (sagaAutocomplete && !sagaAutocomplete.parentElement.contains(e.target)) {
        sagaAutocomplete.classList.add('hidden');
    }

    // Close author autocomplete if clicking outside
    const authorAutocomplete = document.getElementById('author-autocomplete-list');
    if (authorAutocomplete && !authorAutocomplete.parentElement.contains(e.target)) {
        authorAutocomplete.classList.add('hidden');
    }
  });
  
  // Initialize the app
  AppController.init();
});

// Registrar el Service Worker para la PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(registration => {
        console.log('ServiceWorker registrado con éxito:', registration);

        // Escuchar si hay un nuevo Service Worker esperando para activarse.
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Hay una nueva versión lista. Notificamos al usuario.
              UI.showToast('¡Nueva versión disponible! Recarga para actualizar.', 'info');
              // Podrías mostrar un botón de "Recargar" en el toast si quisieras.
            }
          });
        });
      })
      .catch(error => {
        console.log('Error en el registro del ServiceWorker:', error);
      });
  });
}
