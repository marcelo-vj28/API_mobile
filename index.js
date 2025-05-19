require('dotenv').config();
const http = require('http');
const url = require('url');
const { MongoClient } = require('mongodb');

// Configuração do MongoDB Atlas e porta
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dbUser:fiapqz7@dentalanalyticssafe.nt9fxbz.mongodb.net/';
const PORT = process.env.PORT || 3001;

// Função para parsear o corpo da requisição
const getRequestBody = (req) => {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => resolve(JSON.parse(body || '{}')));
    });
};

// Criar o servidor HTTP
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;

    // Configurar cabeçalhos CORS para todas as respostas
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Lidar com solicitações OPTIONS (preflight)
    if (method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Conectar ao MongoDB
    const client = new MongoClient(MONGODB_URI);
    try {
        await client.connect();
        const db = client.db('DentalAnalyticsSafe');  // Nome da base de dados
        const collection = db.collection('Pacientes');  // Nome da coleção

        // GET /pacientes (Listar pacientes)
        if (method === 'GET' && path === '/pacientes') {
            const query = parsedUrl.query.search
                ? {
                    $or: [
                        { nome: { $regex: parsedUrl.query.search, $options: 'i' } },
                        { cpf: { $regex: parsedUrl.query.search, $options: 'i' } }
                    ]
                }
                : {};
            const pacientes = await collection.find(query).toArray();
            res.writeHead(200);
            res.end(JSON.stringify(pacientes));
        }
        // GET /pacientes/:id (Buscar paciente por ID)
        else if (method === 'GET' && path.startsWith('/pacientes/')) {
            const id = parsedUrl.pathname.split('/')[2];  // ID vem da URL
            const paciente = await collection.findOne({ _id: new MongoClient.ObjectID(id) });  // Usando _id para busca no MongoDB
            if (paciente) {
                res.writeHead(200);
                res.end(JSON.stringify(paciente));
            } else {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Paciente não encontrado' }));
            }
        }
        // POST /pacientes (Criar paciente)
        else if (method === 'POST' && path === '/pacientes') {
            const paciente = await getRequestBody(req);
            const result = await collection.insertOne(paciente);
            res.writeHead(201);
            res.end(JSON.stringify({ insertedId: result.insertedId }));
        }
        // PUT /pacientes/:id (Atualizar paciente)
        else if (method === 'PUT' && path.startsWith('/pacientes/')) {
            const id = parsedUrl.pathname.split('/')[2];
            const updatedData = await getRequestBody(req);
            const result = await collection.updateOne(
                { _id: new MongoClient.ObjectID(id) },  // Usando _id
                { $set: updatedData }
            );
            res.writeHead(200);
            res.end(JSON.stringify({ modifiedCount: result.modifiedCount }));
        }
        // DELETE /pacientes/:id (Excluir paciente)
        else if (method === 'DELETE' && path.startsWith('/pacientes/')) {
            const id = parsedUrl.pathname.split('/')[2];
            const result = await collection.deleteOne({ _id: new MongoClient.ObjectID(id) });
            res.writeHead(200);
            res.end(JSON.stringify({ deletedCount: result.deletedCount }));
        }
        // Rota não encontrada
        else {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'Rota não encontrada' }));
        }
    } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: error.message }));
    } finally {
        await client.close();
    }
});

// Iniciar o servidor
server.listen(PORT, () => {
    console.log(`API rodando em http://localhost:${PORT}`);
});
