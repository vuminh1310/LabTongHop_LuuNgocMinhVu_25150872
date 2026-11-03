/* Frontend JS thuan cho web ban sach.
 * Goi API NestJS o /api, dieu huong bang hash (#/...). */
(function () {
  'use strict';

  // ---------- Tien ich ----------
  const $app = document.getElementById('app');
  const $nav = document.getElementById('nav');
  const $toast = document.getElementById('toast');

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(n) || 0);
  const dateStr = (d) => new Date(d).toLocaleString('vi-VN');

  const STATUS_LABEL = {
    pending: 'Chờ xử lý',
    paid: 'Đã thanh toán',
    shipped: 'Đang giao',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy',
  };
  const STATUSES = Object.keys(STATUS_LABEL);

  let toastTimer;
  function toast(msg, isError) {
    $toast.textContent = msg;
    $toast.className = 'toast' + (isError ? ' error' : '');
    $toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($toast.hidden = true), 3000);
  }

  function load(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch (e) {
      return fallback;
    }
  }
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { /* bo qua */ }
  }

  // ---------- Trang thai ----------
  const state = {
    token: load('token', null),
    user: load('user', null),
    cart: load('cart', []), // [{ id, title, price, quantity, stock }]
  };

  const isAdmin = () => state.user && state.user.role === 'admin';

  function setSession(data) {
    state.token = data ? data.accessToken : null;
    state.user = data ? data.user : null;
    save('token', state.token);
    save('user', state.user);
  }
  function saveCart() {
    save('cart', state.cart);
    renderNav();
  }

  // ---------- API ----------
  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers.Authorization = 'Bearer ' + state.token;
    const res = await fetch('/api' + path, { ...options, headers });
    let data = null;
    try { data = await res.json(); } catch (e) { /* khong co body */ }
    if (!res.ok) {
      if (res.status === 401 && state.token) {
        setSession(null);
        renderNav();
        location.hash = '#/login';
      }
      const m = data && data.message;
      throw new Error(Array.isArray(m) ? m.join(', ') : m || 'Có lỗi xảy ra (' + res.status + ')');
    }
    return data;
  }

  // ---------- Thanh dieu huong ----------
  function renderNav() {
    const count = state.cart.reduce((s, i) => s + i.quantity, 0);
    let html = '<a href="#/">Trang chủ</a>';
    html += `<a href="#/cart">Giỏ hàng${count ? `<span class="badge">${count}</span>` : ''}</a>`;
    if (state.user) {
      html += '<a href="#/orders">Đơn của tôi</a>';
      if (isAdmin()) html += '<a href="#/admin">Quản trị</a>';
      html += `<span class="muted">${esc(state.user.email)}</span>`;
      html += '<a href="#/logout">Đăng xuất</a>';
    } else {
      html += '<a href="#/login">Đăng nhập</a><a href="#/register">Đăng ký</a>';
    }
    $nav.innerHTML = html;
  }

  // ---------- Thanh phan dung chung ----------
  function coverHtml(b) {
    return b.coverUrl
      ? `<img src="${esc(b.coverUrl)}" alt="${esc(b.title)}" loading="lazy" />`
      : esc(b.title);
  }

  function addToCart(book, qty = 1) {
    const item = state.cart.find((i) => i.id === book.id);
    const current = item ? item.quantity : 0;
    if (current + qty > book.stock) {
      toast('Chỉ còn ' + book.stock + ' cuốn trong kho', true);
      return;
    }
    if (item) {
      item.quantity += qty;
      item.price = Number(book.price);
      item.stock = book.stock;
    } else {
      state.cart.push({ id: book.id, title: book.title, price: Number(book.price), quantity: qty, stock: book.stock });
    }
    saveCart();
    toast('Đã thêm "' + book.title + '" vào giỏ');
  }

  // ---------- Trang: danh sach sach ----------
  const listState = { search: '', categoryId: '', page: 1 };

  async function viewHome() {
    $app.innerHTML = '<p class="muted">Đang tải...</p>';
    const [cats, result] = await Promise.all([
      api('/categories'),
      api('/books?' + new URLSearchParams(
        Object.entries({ search: listState.search, categoryId: listState.categoryId, page: listState.page, limit: 12 })
          .filter(([, v]) => v !== '' && v != null)
      )),
    ]);
    const pages = Math.max(1, Math.ceil(result.total / result.limit));

    $app.innerHTML = `
      <h1>Sách mới</h1>
      <form class="toolbar" id="filter">
        <input type="search" id="q" placeholder="Tìm theo tên sách hoặc tác giả..." value="${esc(listState.search)}" />
        <select id="cat">
          <option value="">Tất cả thể loại</option>
          ${cats.map((c) => `<option value="${c.id}" ${String(c.id) === String(listState.categoryId) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
        </select>
        <button class="btn" type="submit">Tìm</button>
      </form>
      ${result.items.length ? `<div class="grid">${result.items.map(bookCard).join('')}</div>` : '<div class="empty">Không tìm thấy sách nào.</div>'}
      <div class="pager">
        ${Array.from({ length: pages }, (_, i) => `<button class="btn secondary small ${i + 1 === result.page ? 'active' : ''}" data-page="${i + 1}">${i + 1}</button>`).join('')}
      </div>`;

    document.getElementById('filter').addEventListener('submit', (e) => {
      e.preventDefault();
      listState.search = document.getElementById('q').value.trim();
      listState.categoryId = document.getElementById('cat').value;
      listState.page = 1;
      viewHome().catch(showError);
    });
    $app.querySelectorAll('[data-page]').forEach((btn) =>
      btn.addEventListener('click', () => {
        listState.page = Number(btn.dataset.page);
        viewHome().catch(showError);
      })
    );
    $app.querySelectorAll('[data-add]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const book = result.items.find((b) => b.id === Number(btn.dataset.add));
        if (book) addToCart(book);
      })
    );
  }

  function bookCard(b) {
    return `
      <div class="card book">
        <a href="#/book/${b.id}" class="cover">${coverHtml(b)}</a>
        <div class="book-body">
          <a href="#/book/${b.id}" class="book-title">${esc(b.title)}</a>
          <div class="book-author">${esc(b.author)}</div>
          ${b.category ? `<div><span class="tag">${esc(b.category.name)}</span></div>` : ''}
          <div class="price">${money(b.price)}</div>
          <div class="book-actions">
            ${b.stock > 0
              ? `<button class="btn small" data-add="${b.id}">Thêm vào giỏ</button>`
              : '<span class="out">Hết hàng</span>'}
          </div>
        </div>
      </div>`;
  }

  // ---------- Trang: chi tiet sach ----------
  async function viewBook(id) {
    $app.innerHTML = '<p class="muted">Đang tải...</p>';
    const b = await api('/books/' + id);
    $app.innerHTML = `
      <p><a href="#/">← Quay lại</a></p>
      <div class="detail">
        <div class="card book"><div class="cover">${coverHtml(b)}</div></div>
        <div>
          <h1>${esc(b.title)}</h1>
          <p class="muted">Tác giả: ${esc(b.author)}</p>
          ${b.category ? `<p><span class="tag">${esc(b.category.name)}</span></p>` : ''}
          <p class="price" style="font-size:1.4rem">${money(b.price)}</p>
          <p>${b.stock > 0 ? 'Còn ' + b.stock + ' cuốn' : '<span class="out">Hết hàng</span>'}</p>
          <p style="white-space:pre-line">${esc(b.description || 'Chưa có mô tả.')}</p>
          ${b.stock > 0 ? `
            <div class="qty">
              <input type="number" id="qty" min="1" max="${b.stock}" value="1" />
              <button class="btn" id="add">Thêm vào giỏ</button>
            </div>` : ''}
        </div>
      </div>`;
    const add = document.getElementById('add');
    if (add) {
      add.addEventListener('click', () => {
        const qty = Math.max(1, parseInt(document.getElementById('qty').value, 10) || 1);
        addToCart(b, qty);
      });
    }
  }

  // ---------- Trang: gio hang & dat hang ----------
  function viewCart() {
    if (!state.cart.length) {
      $app.innerHTML = '<h1>Giỏ hàng</h1><div class="empty">Giỏ hàng trống. <a href="#/">Tiếp tục mua sắm</a></div>';
      return;
    }
    const total = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
    $app.innerHTML = `
      <h1>Giỏ hàng</h1>
      <div class="table-wrap"><table>
        <thead><tr><th>Sách</th><th>Đơn giá</th><th>Số lượng</th><th>Thành tiền</th><th></th></tr></thead>
        <tbody>
          ${state.cart.map((i) => `
            <tr>
              <td><a href="#/book/${i.id}">${esc(i.title)}</a></td>
              <td>${money(i.price)}</td>
              <td><input type="number" min="1" max="${i.stock}" value="${i.quantity}" data-qty="${i.id}" style="width:70px" /></td>
              <td>${money(i.price * i.quantity)}</td>
              <td><button class="btn danger small" data-del="${i.id}">Xóa</button></td>
            </tr>`).join('')}
        </tbody>
      </table></div>
      <div class="summary"><strong>Tổng cộng: ${money(total)}</strong></div>
      <h2>Thông tin giao hàng</h2>
      <form id="checkout" class="card">
        <label>Địa chỉ nhận hàng<br />
          <input id="addr" required style="width:100%" placeholder="Số nhà, đường, quận, thành phố" />
        </label>
        <p><button class="btn" type="submit">Đặt hàng</button></p>
      </form>`;

    $app.querySelectorAll('[data-qty]').forEach((inp) =>
      inp.addEventListener('change', () => {
        const item = state.cart.find((i) => i.id === Number(inp.dataset.qty));
        let q = parseInt(inp.value, 10) || 1;
        q = Math.min(Math.max(1, q), item.stock);
        item.quantity = q;
        saveCart();
        viewCart();
      })
    );
    $app.querySelectorAll('[data-del]').forEach((btn) =>
      btn.addEventListener('click', () => {
        state.cart = state.cart.filter((i) => i.id !== Number(btn.dataset.del));
        saveCart();
        viewCart();
      })
    );
    document.getElementById('checkout').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.user) {
        toast('Vui lòng đăng nhập để đặt hàng', true);
        location.hash = '#/login';
        return;
      }
      try {
        await api('/orders', {
          method: 'POST',
          body: JSON.stringify({
            shippingAddress: document.getElementById('addr').value.trim(),
            items: state.cart.map((i) => ({ bookId: i.id, quantity: i.quantity })),
          }),
        });
        state.cart = [];
        saveCart();
        toast('Đặt hàng thành công!');
        location.hash = '#/orders';
      } catch (err) {
        toast(err.message, true);
      }
    });
  }

  // ---------- Trang: dang nhap / dang ky ----------
  function viewAuth(mode) {
    const isLogin = mode === 'login';
    $app.innerHTML = `
      <form class="form card" id="authForm">
        <h1>${isLogin ? 'Đăng nhập' : 'Đăng ký'}</h1>
        ${isLogin ? '' : '<label>Họ tên<input id="fullName" required /></label>'}
        <label>Email<input id="email" type="email" required /></label>
        <label>Mật khẩu<input id="password" type="password" minlength="6" required /></label>
        <button class="btn" type="submit">${isLogin ? 'Đăng nhập' : 'Tạo tài khoản'}</button>
        <p class="muted">${isLogin
          ? 'Chưa có tài khoản? <a href="#/register">Đăng ký</a>'
          : 'Đã có tài khoản? <a href="#/login">Đăng nhập</a>'}</p>
      </form>`;
    document.getElementById('authForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = {
        email: document.getElementById('email').value.trim(),
        password: document.getElementById('password').value,
      };
      if (!isLogin) body.fullName = document.getElementById('fullName').value.trim();
      try {
        setSession(await api(isLogin ? '/auth/login' : '/auth/register', { method: 'POST', body: JSON.stringify(body) }));
        renderNav();
        toast(isLogin ? 'Đăng nhập thành công' : 'Đăng ký thành công');
        location.hash = '#/';
      } catch (err) {
        toast(err.message, true);
      }
    });
  }

  // ---------- Trang: don hang cua toi ----------
  function orderRows(orders, withUser) {
    return orders.map((o) => `
      <tr>
        <td>#${o.id}</td>
        ${withUser ? `<td>${esc(o.user ? o.user.email : '')}</td>` : ''}
        <td>${dateStr(o.createdAt)}</td>
        <td>${(o.items || []).map((i) => `${esc(i.book ? i.book.title : '?')} × ${i.quantity}`).join('<br />')}</td>
        <td>${money(o.totalAmount)}</td>
        <td>${withUser
          ? `<select data-status="${o.id}">${STATUSES.map((s) => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}</select>`
          : `<span class="status ${o.status}">${STATUS_LABEL[o.status]}</span>`}</td>
        <td>${esc(o.shippingAddress)}</td>
      </tr>`).join('');
  }

  async function viewOrders() {
    if (!state.user) { location.hash = '#/login'; return; }
    $app.innerHTML = '<p class="muted">Đang tải...</p>';
    const orders = await api('/orders/mine');
    $app.innerHTML = `<h1>Đơn hàng của tôi</h1>` + (orders.length
      ? `<div class="table-wrap"><table>
          <thead><tr><th>Mã</th><th>Ngày đặt</th><th>Sản phẩm</th><th>Tổng tiền</th><th>Trạng thái</th><th>Địa chỉ</th></tr></thead>
          <tbody>${orderRows(orders, false)}</tbody></table></div>`
      : '<div class="empty">Bạn chưa có đơn hàng nào.</div>');
  }

  // ---------- Trang: quan tri ----------
  const adminState = { tab: 'books', editing: null };

  async function viewAdmin() {
    if (!isAdmin()) {
      $app.innerHTML = '<div class="empty">Bạn không có quyền truy cập trang này.</div>';
      return;
    }
    $app.innerHTML = `
      <h1>Quản trị</h1>
      <div class="tabs">
        ${[['books', 'Sách'], ['categories', 'Thể loại'], ['orders', 'Đơn hàng']]
          .map(([k, label]) => `<button class="btn secondary small ${adminState.tab === k ? 'active' : ''}" data-tab="${k}">${label}</button>`).join('')}
      </div>
      <div id="adminBody"><p class="muted">Đang tải...</p></div>`;
    $app.querySelectorAll('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        adminState.tab = b.dataset.tab;
        adminState.editing = null;
        viewAdmin().catch(showError);
      })
    );
    const body = document.getElementById('adminBody');
    if (adminState.tab === 'books') await adminBooks(body);
    else if (adminState.tab === 'categories') await adminCategories(body);
    else await adminOrders(body);
  }

  async function adminBooks(body) {
    const [cats, result] = await Promise.all([api('/categories'), api('/books?limit=100')]);
    const e = adminState.editing || {};
    body.innerHTML = `
      <form id="bookForm" class="card form-grid">
        <h2 class="full" style="margin:0">${e.id ? 'Sửa sách #' + e.id : 'Thêm sách mới'}</h2>
        <label>Tên sách<input id="b_title" required value="${esc(e.title)}" /></label>
        <label>Tác giả<input id="b_author" required value="${esc(e.author)}" /></label>
        <label>Giá (VND)<input id="b_price" type="number" min="0" required value="${e.price != null ? Number(e.price) : ''}" /></label>
        <label>Tồn kho<input id="b_stock" type="number" min="0" required value="${e.stock != null ? e.stock : ''}" /></label>
        <label>Thể loại
          <select id="b_cat"><option value="">-- Không chọn --</option>
            ${cats.map((c) => `<option value="${c.id}" ${e.category && e.category.id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select></label>
        <label>Link ảnh bìa<input id="b_cover" value="${esc(e.coverUrl)}" placeholder="https://..." /></label>
        <label class="full">Mô tả<textarea id="b_desc" rows="3">${esc(e.description)}</textarea></label>
        <div class="full">
          <button class="btn" type="submit">${e.id ? 'Lưu thay đổi' : 'Thêm sách'}</button>
          ${e.id ? '<button class="btn secondary" type="button" id="cancelEdit">Hủy</button>' : ''}
        </div>
      </form>
      <h2>Danh sách sách (${result.total})</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Tên sách</th><th>Tác giả</th><th>Giá</th><th>Kho</th><th>Thể loại</th><th></th></tr></thead>
        <tbody>${result.items.map((b) => `
          <tr>
            <td>${b.id}</td><td>${esc(b.title)}</td><td>${esc(b.author)}</td>
            <td>${money(b.price)}</td><td>${b.stock}</td><td>${b.category ? esc(b.category.name) : ''}</td>
            <td class="actions-cell">
              <button class="btn secondary small" data-edit="${b.id}">Sửa</button>
              <button class="btn danger small" data-del="${b.id}">Xóa</button>
            </td>
          </tr>`).join('')}</tbody>
      </table></div>`;

    document.getElementById('bookForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const payload = {
        title: document.getElementById('b_title').value.trim(),
        author: document.getElementById('b_author').value.trim(),
        price: Number(document.getElementById('b_price').value),
        stock: parseInt(document.getElementById('b_stock').value, 10),
        description: document.getElementById('b_desc').value.trim(),
      };
      const cover = document.getElementById('b_cover').value.trim();
      if (cover) payload.coverUrl = cover;
      const cat = document.getElementById('b_cat').value;
      if (cat) payload.categoryId = Number(cat);
      try {
        await api(e.id ? '/books/' + e.id : '/books', { method: e.id ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
        toast(e.id ? 'Đã cập nhật sách' : 'Đã thêm sách');
        adminState.editing = null;
        viewAdmin().catch(showError);
      } catch (err) { toast(err.message, true); }
    });
    const cancel = document.getElementById('cancelEdit');
    if (cancel) cancel.addEventListener('click', () => { adminState.editing = null; viewAdmin().catch(showError); });
    body.querySelectorAll('[data-edit]').forEach((btn) =>
      btn.addEventListener('click', () => {
        adminState.editing = result.items.find((b) => b.id === Number(btn.dataset.edit));
        viewAdmin().catch(showError);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
    );
    body.querySelectorAll('[data-del]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        if (!confirm('Xóa cuốn sách này?')) return;
        try {
          await api('/books/' + btn.dataset.del, { method: 'DELETE' });
          toast('Đã xóa');
          viewAdmin().catch(showError);
        } catch (err) { toast('Không xóa được (sách có thể đã nằm trong đơn hàng): ' + err.message, true); }
      })
    );
  }

  async function adminCategories(body) {
    const cats = await api('/categories');
    body.innerHTML = `
      <form id="catForm" class="card form-grid">
        <label>Tên thể loại<input id="c_name" required /></label>
        <label>Mô tả<input id="c_desc" /></label>
        <div class="full"><button class="btn" type="submit">Thêm thể loại</button></div>
      </form>
      <h2>Danh sách thể loại</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Tên</th><th>Mô tả</th><th></th></tr></thead>
        <tbody>${cats.map((c) => `
          <tr><td>${c.id}</td><td>${esc(c.name)}</td><td>${esc(c.description)}</td>
          <td><button class="btn danger small" data-del="${c.id}">Xóa</button></td></tr>`).join('')}</tbody>
      </table></div>`;
    document.getElementById('catForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const payload = { name: document.getElementById('c_name').value.trim() };
      const d = document.getElementById('c_desc').value.trim();
      if (d) payload.description = d;
      try {
        await api('/categories', { method: 'POST', body: JSON.stringify(payload) });
        toast('Đã thêm thể loại');
        viewAdmin().catch(showError);
      } catch (err) { toast(err.message, true); }
    });
    body.querySelectorAll('[data-del]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        if (!confirm('Xóa thể loại này?')) return;
        try {
          await api('/categories/' + btn.dataset.del, { method: 'DELETE' });
          toast('Đã xóa');
          viewAdmin().catch(showError);
        } catch (err) { toast(err.message, true); }
      })
    );
  }

  async function adminOrders(body) {
    const orders = await api('/orders');
    body.innerHTML = orders.length
      ? `<div class="table-wrap"><table>
          <thead><tr><th>Mã</th><th>Khách hàng</th><th>Ngày đặt</th><th>Sản phẩm</th><th>Tổng tiền</th><th>Trạng thái</th><th>Địa chỉ</th></tr></thead>
          <tbody>${orderRows(orders, true)}</tbody></table></div>`
      : '<div class="empty">Chưa có đơn hàng nào.</div>';
    body.querySelectorAll('[data-status]').forEach((sel) =>
      sel.addEventListener('change', async () => {
        try {
          await api('/orders/' + sel.dataset.status + '/status', { method: 'PATCH', body: JSON.stringify({ status: sel.value }) });
          toast('Đã cập nhật trạng thái');
        } catch (err) { toast(err.message, true); }
      })
    );
  }

  // ---------- Dieu huong ----------
  function showError(err) {
    $app.innerHTML = `<div class="empty">Lỗi: ${esc(err.message)}</div>`;
  }

  async function route() {
    renderNav();
    const hash = location.hash.replace(/^#/, '') || '/';
    const parts = hash.split('/').filter(Boolean);
    window.scrollTo(0, 0);
    try {
      if (parts.length === 0) await viewHome();
      else if (parts[0] === 'book' && parts[1]) await viewBook(parts[1]);
      else if (parts[0] === 'cart') viewCart();
      else if (parts[0] === 'login') viewAuth('login');
      else if (parts[0] === 'register') viewAuth('register');
      else if (parts[0] === 'orders') await viewOrders();
      else if (parts[0] === 'admin') await viewAdmin();
      else if (parts[0] === 'logout') {
        setSession(null);
        renderNav();
        toast('Đã đăng xuất');
        location.hash = '#/';
      } else $app.innerHTML = '<div class="empty">Không tìm thấy trang.</div>';
    } catch (err) {
      showError(err);
    }
  }

  window.addEventListener('hashchange', route);
  route();
})();
