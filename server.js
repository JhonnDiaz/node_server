const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');

const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;
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

app.get('/metodo_pago', (req, res) => {
    const { nombre, tipo } = req.query;

    let query = 'SELECT * FROM Metodos_Pago';
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

// Ruta para eliminar un método de pago
app.delete('/metodos_pago/:id', (req, res) => {
    const { id } = req.params;

    if (!id) {
        return res.status(400).json({ error: 'Debe proporcionar un ID válido para eliminar.' });
    }

    // Eliminar el registro de la base de datos
    db.run(
        'DELETE FROM Metodos_Pago WHERE Metodo_Pago_ID = ?',
        [id],
        function (err) {
            if (err) {
                return res.status(500).json({ error: 'Error al eliminar el método de pago.' });
            }

            if (this.changes === 0) {
                // Si no se encontraron filas para eliminar
                return res.status(404).json({ message: 'Método de pago no encontrado.' });
            }

            res.status(200).json({ message: 'Método de pago eliminado exitosamente.' });
        }
    );
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
    console.log('Datos recibidos:', req.body);
    const { email, password, name, direccion, telefono } = req.body;
    console.log('Campos:', email, password, name, direccion, telefono);

    // Asegúrate de que estas variables están bien definidas
    console.log("Datos recibidos:", { email, password, name, direccion, telefono });

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
                    // Insertar el nuevo cliente en la base de datos
                    db.run(
                        `INSERT INTO Clientes (Nombre, Direccion, Telefono, Password, Email) 
                         VALUES (?, ?, ?, ?, ?)`,
                        [name, direccion, telefono, password, email],  // Uso correcto de las variables
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
                        direccion:row.Direccion,
                        contraseña:row.Password,
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

// Obtener todas las compras realizadas por un cliente con estado "Pendiente" o "Aprobada"
app.get('/compras', (req, res) => {
    const { cliente_id } = req.query;

    // Validar que se proporcione cliente_id
    if (!cliente_id) {
        return res.status(400).json({ error: 'Debe proporcionar un Cliente_ID.' });
    }

    // Consulta SQL con filtro de estado
    const query = `
    SELECT 
        V.Venta_ID,
        V.Fecha_Venta,
        V.Estado AS Estado_Venta,
        P.Nombre AS Producto_Nombre,
        DV.Cantidad,
        IV.Subtotal,
        IV.Descuento,
        IV.IVA,
        IV.Total,
        (SELECT MP.Metodo_Pago 
         FROM Pagos AS PG 
         INNER JOIN Metodos_Pago AS MP ON PG.Metodo_Pago_ID = MP.Metodo_Pago_ID
         WHERE PG.Venta_ID = V.Venta_ID
         LIMIT 1) AS Metodo_Pago -- Obtener un solo método de pago por venta
    FROM Ventas AS V
    INNER JOIN Detalles_Ventas AS DV ON V.Venta_ID = DV.Venta_ID
    INNER JOIN Productos AS P ON DV.Producto_ID = P.Producto_ID
    INNER JOIN Info_Venta AS IV ON DV.Detalle_Venta_ID = IV.Detalle_Venta_ID
    WHERE V.Cliente_ID = ?
    AND (V.Estado = 'Pendiente' OR V.Estado = 'Aprobada')
`;


    // Ejecutar la consulta SQL
    db.all(query, [cliente_id], (err, rows) => {
        if (err) {
            console.error('Error al ejecutar la consulta:', err.message);
            return res.status(500).json({ error: 'Error al obtener las compras del cliente.' });
        }

        // Validar si se encontraron resultados
        if (rows.length === 0) {
            return res.status(404).json({ message: 'No se encontraron compras pendientes o aprobadas para este cliente.' });
        }

        // Devolver los resultados
        res.json(rows);
    });
});

// Cambiar el estado de una venta a "Cancelada"
app.patch('/ventas/:venta_id/cancelar', (req, res) => {
    const { venta_id } = req.params;

    if (!venta_id) {
        return res.status(400).json({ error: 'Debe proporcionar un ID de venta válido.' });
    }

    // Verificar si la venta existe antes de actualizar
    db.get('SELECT * FROM Ventas WHERE Venta_ID = ?', [venta_id], (err, venta) => {
        if (err) {
            return res.status(500).json({ error: 'Error al buscar la venta.' });
        }

        if (!venta) {
            return res.status(404).json({ error: 'Venta no encontrada.' });
        }

        if (venta.Estado === 'Cancelada') {
            return res.status(400).json({ error: 'La venta ya está cancelada.' });
        }

        // Actualizar el estado de la venta a "Cancelada"
        db.run(
            'UPDATE Ventas SET Estado = ? WHERE Venta_ID = ?',
            ['Cancelada', venta_id],
            function (err) {
                if (err) {
                    return res.status(500).json({ error: 'Error al cancelar la venta.' });
                }

                if (this.changes === 0) {
                    return res.status(404).json({ error: 'No se pudo cancelar la venta. Verifique el ID.' });
                }

                res.json({ message: 'Venta cancelada con éxito.', venta_id });
            }
        );
    });
});




// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
