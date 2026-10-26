const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/groovespace';
        await mongoose.connect(uri);
        console.log('Capa de persistencia: Enlace exitoso con MongoDB Compass.');
    } catch (error) {
        console.log('Error crítico en el enlace de datos:', error.message);
        process.exit(1);
    }
};

module.exports = connectDB;