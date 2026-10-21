const crypto = require('crypto');                                                                                          
    const { query } = require('../config/database');                                                                                                                                       
                                                                                                                                                                                           
    const issueFuelAdvance = async (driverId, amountFcfa = 15000, stationPartner = 'TotalEnergies') => {                                                                                   
      const voucherCode = 'FUEL-' + crypto.randomBytes(4).toString('hex').toUpperCase();                                                                                                   
      const { rows } = await query(                                                                                                                                                        
        `INSERT INTO fuel_advances (driver_id, station_partner, voucher_code, amount_fcfa, status)                                                                                        
         VALUES ($1, $2, $3, $4, 'issued') RETURNING *`,                                                                                                                                  
        [driverId, stationPartner, amountFcfa, voucherCode]                                                                                                                                
      );                                                                                                                                                                                   
      return rows[0];                                                                                                                                                                      
    };                                                                                                                                                                                     
                                                                                                                                                                                           
    module.exports = { issueFuelAdvance };                                                                                                                                                 
    