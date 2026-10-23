const API_URL = "https://backendwebmenu.onrender.com/api/productos";
const contenedorProductos = document.getElementById("productos-container");
let carrito = [];

// Crear y mostrar modales usando la instancia nativa del HTML
function mostrarModal(titulo, mensaje, esConfirmacion = false, callback = null) {
    const modalPrevio = document.getElementById('modal-dinamico');
    if (modalPrevio) modalPrevio.remove();
    
    const triggerPrevio = document.getElementById('btn-trigger-modal');
    if (triggerPrevio) triggerPrevio.remove();

    const modalHTML = `
    <!-- Botón oculto para activar el modal mediante los atributos de Bootstrap -->
    <button type="button" id="btn-trigger-modal" class="d-none" data-bs-toggle="modal" data-bs-target="#modal-dinamico"></button>

    <div class="modal fade" id="modal-dinamico" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content text-white bg-dark">
                <div class="modal-header border-secondary">
                    <h5 class="modal-title">${titulo}</h5>
                </div>
                <div class="modal-body">
                    <p style="white-space: pre-wrap; margin: 0;">${mensaje}</p>
                </div>
                <div class="modal-footer border-secondary">
                    ${esConfirmacion ? `<button type="button" class="btn btn-secondary" data-bs-dismiss="modal" id="btn-cancelar-modal">Cancelar</button>` : ''}
                    <button type="button" class="btn btn-primary" data-bs-dismiss="modal" id="btn-aceptar-modal">Aceptar</button>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('btn-aceptar-modal').addEventListener('click', () => {
        if (callback) callback(true);
    });

    if (esConfirmacion) {
        document.getElementById('btn-cancelar-modal').addEventListener('click', () => {
            if (callback) callback(false);
        });
    }

    document.getElementById('btn-trigger-modal').click();
}

// --- Funciones de LocalStorage ---
function guardarCarrito() {
  localStorage.setItem("carrito_compras", JSON.stringify(carrito));
}

function cargarCarrito() {
  const carritoGuardado = localStorage.getItem("carrito_compras");
  if (carritoGuardado) {
    carrito = JSON.parse(carritoGuardado);
    actualizarTablaOrden(); // Actualiza la UI si había algo guardado
  }
}
// ----------------------------------------

// 1. Obtener los productos del backend
async function cargarProductos() {
  try {
    const respuesta = await fetch(API_URL);
    const productos = await respuesta.json();
    renderizarCatalogo(productos);
  } catch (error) {
    console.error("Error al cargar productos:", error);
    contenedorProductos.innerHTML = "<p>Error al cargar el menú.</p>";
  }
}

// 2. Renderizar los productos en el HTML
function renderizarCatalogo(productos) {
  contenedorProductos.innerHTML = "";

  productos.forEach((producto) => {
    const card = document.createElement("section");
    card.classList.add("card", "shadow-sm", "border", "border-secondary", "border-opacity-25", "border-3");
    card.style.width = "23%";
    card.style.height = "auto";
    card.style.maxHeight = "400px";
    card.style.margin = "1%";
    
    const impuestoTexto = producto.Taxes
      ? `+ ${producto.Taxes.tax_percentage * 100}% ${producto.Taxes.tax_name}`
      : "Sin impuesto";

    card.innerHTML = `
            <img src="${producto.p_img}" class="card-img-top" alt="Imagen de ${producto.p_name}" style="height: 200px; object-fit: cover;">
            <div class="card-body bg-dark text-white">
                <h4 class="card-title">${producto.p_name}</h4>
                <p class="card-text">${producto.p_price} (${impuestoTexto})</p>
                <a href="javascript:void(0)" class="btn btn-primary" onclick="agregarAlCarrito(${producto.product_id}, '${producto.p_name}', ${producto.p_price}, ${producto.Taxes ? producto.Taxes.tax_percentage : 0})">
                    Agregar a la orden
                </a>
            </div>
        `;

    contenedorProductos.appendChild(card);
  });
}

// 3. Lógica básica del carrito
function agregarAlCarrito(id, nombre, precio, porcentajeImpuesto) {
  const productoExistente = carrito.find((item) => item.id === id);

  if (productoExistente) {
    productoExistente.cantidad += 1;
  } else {
    carrito.push({ id, nombre, precio, porcentajeImpuesto, cantidad: 1 });
  }

  actualizarTablaOrden();
  guardarCarrito(); // Guardamos el cambio en LocalStorage
}

function actualizarTablaOrden() {
  const tbody = document.querySelector("tbody");
  const totalSpan = document.getElementById("total");
  const impuestoSpan = document.getElementById("impuesto");
  tbody.innerHTML = "";
  let totalFactura = 0;
  let totalImpuestos = 0;

  carrito.forEach((item) => {
    const subtotalPrecio = item.precio * item.cantidad;
    const valorImpuesto = subtotalPrecio * item.porcentajeImpuesto;

    totalFactura += subtotalPrecio + valorImpuesto;
    totalImpuestos += valorImpuesto;

    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>${item.cantidad}</td>
            <td>${item.nombre}</td>
            <td>$${subtotalPrecio.toFixed(2)}</td>
            <td>$${valorImpuesto.toFixed(2)}</td>
            <td>
                <button onclick="eliminarDelCarrito(${item.id})" class="btn btn-outline-danger btn-sm">-</button>
            </td>
        `;
    tbody.appendChild(tr);
  });

  totalSpan.textContent = totalFactura.toFixed(2);
  impuestoSpan.textContent = totalImpuestos.toFixed(2);
}

// Lógica para eliminar o reducir cantidad
function eliminarDelCarrito(id) {
  const index = carrito.findIndex((item) => item.id === id);

  if (index !== -1) {
    if (carrito[index].cantidad > 1) {
      carrito[index].cantidad -= 1;
    } else {
      carrito.splice(index, 1);
    }
    actualizarTablaOrden();
    guardarCarrito(); // Guardamos el cambio en LocalStorage
  }
}

// Obtiene la orden completa desde la base de datos (orders + order_items + Products)
async function obtenerOrdenCompleta(orderId) {
  const respuesta = await fetch(`http://localhost:3000/api/orders/${orderId}`);
  const data = await respuesta.json();
  if (!respuesta.ok) {
    throw new Error(data.error || "No se pudo obtener la orden");
  }
  return data.orden || data;
}

// Construye el texto del resumen usando únicamente datos de la BD
function formatearResumenOrden(orden) {
  const items = orden.order_items || [];
  let impuestoTotal = 0;

  const lineas = items.map((it) => {
    const tasa = it.tax_rate;
    const subtotal = it.unit_price * it.quantity;
    impuestoTotal += subtotal * tasa;
    const nombre = (it.Products && it.Products.p_name) || `Producto #${it.product_id}`;
    return `• ${it.quantity} x ${nombre} — $${subtotal.toFixed(2)}`;
  });

  const fecha = orden.order_date;

  return (
    `¡Pedido guardado exitosamente!\n\n` +
    `Número de orden: ${orden.id}\n` +
    `Fecha: ${fecha}\n` +
    `Estado: ${orden.status}\n\n` +
    `Productos:\n${lineas.join("\n")}\n\n` +
    `Impuesto: $${impuestoTotal.toFixed(2)}\n` +
    `Total pagado: $${Number(orden.total).toFixed(2)}`
  );
}

// Capturar los botones
const btnConfirmar = document.getElementById("btn-confirmar");
const btnVaciar = document.getElementById("btn-vaciar");

// Lógica para enviar el pedido al backend
btnConfirmar.addEventListener("click", async () => {
  if (carrito.length === 0) {
    mostrarModal(
      "Atención",
      "Agrega al menos un producto a la orden antes de confirmar."
    );
    return;
  }

  const totalFactura = parseFloat(document.getElementById("total").textContent);

  try {
    btnConfirmar.disabled = true;
    btnConfirmar.textContent = "Procesando...";

    const respuesta = await fetch("http://localhost:3000/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cart: carrito,
        total: totalFactura,
      }),
    });

    const data = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(data.error || "Fallo de red");
    }

    const ordenCompleta = await obtenerOrdenCompleta(data.orden.id);
    mostrarModal("¡Éxito!", formatearResumenOrden(ordenCompleta));
    vaciarCarrito();
  } catch (error) {
    console.error("Error al confirmar:", error);
    mostrarModal("Error", "Error al confirmar el pedido: " + error.message);
  } finally {
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = "Confirmar pago";
  }
});

// Función extra para el botón de "Vaciar orden"
function vaciarCarrito() {
  carrito = [];
  actualizarTablaOrden();
  guardarCarrito(); // Limpiamos también el LocalStorage
}

btnVaciar.addEventListener("click", () => {
  if (carrito.length > 0) {
    mostrarModal(
      "Confirmar",
      "¿Estás seguro de que deseas vaciar toda la orden?",
      true,
      (confirmado) => {
        if (confirmado) {
          vaciarCarrito();
        }
      }
    );
  }
});

// Inicializar la carga
cargarCarrito(); // 1. Recuperamos el carrito si existe
cargarProductos(); // 2. Cargamos el catálogo

// Mostrar modal de atención
mostrarModal("Atención", "El Microservicio se encuentra en la nube usando Render gratuitamente, por lo que puede que demore en cargar la página. Recargue la página si no se muestran los productos en 1 minuto.");
