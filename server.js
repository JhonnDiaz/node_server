const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');

const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your_secret_key'; 


// Configurar middlewares
app.use(bodyParser.json());
app.use(cors());

// Crear o conectar la base de datos SQLite
const db = new sqlite3.Database('./tienda_ropa.db', (err) => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err.message);
    } else {
        console.log('Conexión exitosa a la base de datos.');
    }
});


// Rutas de la API
// Obtener todos los clientes
app.get('/clientes', (req, res) => {
    db.all('SELECT * FROM Clientes', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

app.get('/productos', (req, res) => {
    const { nombre, tipo } = req.query;

    let query = 'SELECT * FROM Productos';
    const params = [];

    if (nombre || tipo) {
        query += ' WHERE';
        if (nombre) {
            query += ' Nombre LIKE ?';
            params.push(`%${nombre}%`);
        }
        if (tipo) {
            query += nombre ? ' AND' : '';
            query += ' tipo = ?';
            params.push(tipo);
        }
    }

    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// Agregar un nuevo cliente
app.post('/clientes', (req, res) => {
    const { Nombre, Direccion, Telefono } = req.body;
    db.run(
        'INSERT INTO Clientes (Nombre, Direccion, Telefono) VALUES (?, ?, ?)',
        [Nombre, Direccion, Telefono],
        function (err) {
            if (err) {
                res.status(500).json({ error: err.message });
            } else {
                res.json({ Cliente_ID: this.lastID });
            }
        }
    );
});



// Ruta para el registro de usuarios
app.post('/register', (req, res) => {
    const { email, password, name, direccion, telefono } = req.body;


    // Validar si el email ya está registrado
    db.get('SELECT * FROM Clientes WHERE Email = ?', [email], (err, row) => {
        if (err) {
            res.status(500).json({ error: 'Error al buscar el correo electrónico.' });
        } else if (row) {
            res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
        } else {
            // Validar si la contraseña ya está en uso
            db.get('SELECT * FROM Clientes WHERE Password = ?', [password], (err, passRow) => {
                if (err) {
                    res.status(500).json({ error: 'Error al buscar la contraseña.' });
                } else if (passRow) {
                    res.status(400).json({ error: 'La contraseña ya está en uso. Por favor, elige otra.' });
                } else {
                    // Insertar el nuevo cliente en la base de datos sin encriptar la contraseña
                    db.run(
                        `INSERT INTO Clientes (Nombre, Direccion, Telefono, Password, Email) 
                        VALUES (?, ?, ?, ?, ?)`,
                        [nombre, direccion, telefono, password, email],
                        function (err) {
                            if (err) {
                                res.status(500).json({ error: 'Error al registrar el usuario.' });
                            } else {
                                res.json({ 
                                    message: 'Usuario registrado exitosamente.', 
                                    userID: this.lastID 
                                });
                            }
                        }
                    );
                }
            });
        }
    });
});



// Ruta para el login de usuarios
app.get('/login', (req, res) => {
    const { email, password } = req.query; // Usamos query params en lugar de body

    if (!email || !password) {
        return res.status(400).json({ error: 'Faltan parámetros de correo electrónico o contraseña' });
    }

    // Buscar el usuario por el correo electrónico en la tabla Clientes
    db.get('SELECT * FROM Clientes WHERE Email = ?', [email], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        } else if (!row) {
            return res.status(400).json({ error: 'Credenciales inválidas' });
        } else {
            // Comparar la contraseña proporcionada con la almacenada en la base de datos
            if (row.Password === password) {
                // Crear un token JWT
                const token = jwt.sign({ userId: row.Cliente_ID }, 'your_secret_key', { expiresIn: '1h' });
                return res.json({
                    message: 'Autenticación exitosa',
                    token,
                    user: {
                        id: row.Cliente_ID,
                        name: row.Nombre,
                        email: row.Email,
                        phone: row.Telefono, 
                    }
                });
            } else {
                return res.status(400).json({ error: 'Credenciales inválidas' });
            }
        }
    });
});

// API para realizar una venta
app.post('/venta', (req, res) => {
    const { cliente_id, productos, metodo_pago_id, subtotal, descuento, iva, total } = req.body;

    // 1. Crear la venta
    db.run(
        'INSERT INTO Ventas (Cliente_ID, Fecha_Venta) VALUES (?, ?)',
        [cliente_id, new Date().toISOString()],
        function (err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            const venta_id = this.lastID; // ID de la venta recién insertada

            // 2. Insertar los detalles de la venta (productos vendidos)
            productos.forEach((producto) => {
                const { producto_id, cantidad } = producto;

                // Primero insertamos el detalle de la venta (producto y cantidad)
                db.run(
                    'INSERT INTO Detalles_Ventas (Venta_ID, Producto_ID, Cantidad) VALUES (?, ?, ?)',
                    [venta_id, producto_id, cantidad],
                    function (err) {
                        if (err) {
                            return res.status(500).json({ error: err.message });
                        }

                        const detalle_venta_id = this.lastID; // ID del detalle de la venta insertado

                        // 3. Insertar la información de la venta (subtotales, descuentos, IVA, total)
                        db.run(
                            'INSERT INTO Info_Venta (Detalle_Venta_ID, Subtotal, Descuento, IVA, Total) VALUES (?, ?, ?, ?, ?)',
                            [detalle_venta_id, subtotal, descuento, iva, total],
                            (err) => {
                                if (err) {
                                    return res.status(500).json({ error: err.message });
                                }
                            }
                        );
                    }
                );
            });

            // 4. Insertar el pago realizado
            db.run(
                'INSERT INTO Pagos (Venta_ID, Monto_Pagado, Metodo_Pago_ID) VALUES (?, ?, ?)',
                [venta_id, total, metodo_pago_id],
                (err) => {
                    if (err) {
                        return res.status(500).json({ error: err.message });
                    }
                    return res.status(200).json({ message: 'Venta realizada con éxito', venta_id: venta_id });
                }
            );
        }
    );
});




// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});