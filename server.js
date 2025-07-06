const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');

const app = express();

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false
}));

// 🔐 Auth middleware
function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

// 🔸 Routes
app.get('/', (req, res) => res.redirect('/login'));

app.get('/register', (req, res) => {
  res.render('register', { message: '' });
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  db.run(
    `INSERT INTO users (username, password) VALUES (?, ?)`,
    [username, password],
    function (err) {
      if (err) return res.render('register', { message: 'Username already exists' });
      res.redirect('/login');
    }
  );
});

app.get('/login', (req, res) => {
  res.render('login', { message: '' });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get(
    `SELECT * FROM users WHERE username = ? AND password = ?`,
    [username, password],
    (err, user) => {
      if (user) {
        req.session.userId = user.id;
        res.redirect('/dashboard');
      } else {
        res.render('login', { message: 'Invalid credentials' });
      }
    }
  );
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/dashboard', requireLogin, (req, res) => {
  db.all(
    `SELECT * FROM books WHERE user_id = ?`,
    [req.session.userId],
    (err, books) => {
      res.render('dashboard', { books });
    }
  );
});

app.post('/add-book', requireLogin, (req, res) => {
  const { title, author, status } = req.body;
  db.run(
    `INSERT INTO books (user_id, title, author, status) VALUES (?, ?, ?, ?)`,
    [req.session.userId, title, author, status],
    () => res.redirect('/dashboard')
  );
});

app.post('/edit-book/:id', requireLogin, (req, res) => {
  const { title, author, status } = req.body;
  const bookId = req.params.id;
  db.run(
    `UPDATE books SET title = ?, author = ?, status = ? WHERE id = ? AND user_id = ?`,
    [title, author, status, bookId, req.session.userId],
    () => res.redirect('/dashboard')
  );
});

app.get('/delete-book/:id', requireLogin, (req, res) => {
  db.run(
    `DELETE FROM books WHERE id = ? AND user_id = ?`,
    [req.params.id, req.session.userId],
    () => res.redirect('/dashboard')
  );
});

app.get('/toggle-status/:id', requireLogin, (req, res) => {
  db.get(
    `SELECT status FROM books WHERE id = ? AND user_id = ?`,
    [req.params.id, req.session.userId],
    (err, book) => {
      if (!book) return res.redirect('/dashboard');
      const newStatus = book.status === 'Read' ? 'Unread' : 'Read';
      db.run(
        `UPDATE books SET status = ? WHERE id = ? AND user_id = ?`,
        [newStatus, req.params.id, req.session.userId],
        () => res.redirect('/dashboard')
      );
    }
  );
});

// 🔸 Start server
app.listen(3000, () => {
  console.log('✅ Server running at http://localhost:3000');
});

