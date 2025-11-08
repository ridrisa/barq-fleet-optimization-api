const { v4: uuidv4 } = require('uuid');

class LogisticsController {
  constructor(logisticsService) {
    this.logisticsService = logisticsService;
  }

  async createOptimizationRequest(req, res) {
    try {
      const requestData = req.body;
      console.log('Received optimization request');

      // Validate the request
      const validationResult = this.validateOptimizationRequest(requestData);
      if (!validationResult.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request',
          details: validationResult.errors,
        });
      }

      // Generate a unique ID for this request
      const requestId = uuidv4();

      // Store the complete original request for reference
      const originalRequest = JSON.parse(JSON.stringify(requestData));

      // Process the request asynchronously
      this.logisticsService
        .processOptimizationRequest(requestId, requestData, originalRequest)
        .then((optimizationResult) => {
          console.log(`Optimization request ${requestId} completed successfully`);

          // Update the status in the database to completed
          this.logisticsService.updateRequestStatus(requestId, 'completed', optimizationResult);
        })
        .catch((error) => {
          console.error(`Optimization request ${requestId} failed: ${error.message}`);

          // Update the status in the database to failed
          this.logisticsService.updateRequestStatus(requestId, 'failed', { error: error.message });
        });

      // Immediately return a response with the request ID
      return res.status(202).json({
        success: true,
        message: 'Optimization request accepted for processing',
        requestId,
        status: 'processing',
      });
    } catch (error) {
      console.error('Error processing optimization request:', error);
      return res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message,
      });
    }
  }

  validateOptimizationRequest(request) {
    // Placeholder for validation logic
    return { valid: true };
  }
}

module.exports = LogisticsController;
