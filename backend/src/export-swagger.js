const fs = require('fs');
const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerConfig = require('./api/swagger');

// Generate full swagger spec
const swaggerDocs = swaggerJsdoc(swaggerConfig.options);

// Export to JSON file
fs.writeFileSync(path.join(__dirname, '..', 'swagger.json'), JSON.stringify(swaggerDocs, null, 2));

console.log('Swagger documentation exported to backend/swagger.json');
