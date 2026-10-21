const { query } = require('../config/database');                                                                              
                                                                                                                                                                                           
    const requestBreakdownRelief = async (orderId, driverId, breakdownReason, lat, lng) => {                                                                                               
      const { rows } = await query(                                                                                                                                                        
        `INSERT INTO breakdown_relief_requests (order_id, original_driver_id, breakdown_reason, lat, lng, status)                                                                         
         VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,                                                                                                                             
        [orderId, driverId, breakdownReason, lat, lng]                                                                                                                                     
      );                                                                                                                                                                                   
      return rows[0];                                                                                                                                                                      
    };                                                                                                                                                                                     
                                                                                                                                                                                           
    module.exports = { requestBreakdownRelief };                                                                                                                                           
    