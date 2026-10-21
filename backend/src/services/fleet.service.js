const { query } = require('../config/database');                                                                                   
    const { haversineDistance } = require('./pricing.service');                                                                                                                            
                                                                                                                                                                                           
    const checkAbnormalStops = async (truckPlate, currentLat, currentLng, driverId) => {                                                                                                   
      const { rows } = await query(                                                                                                                                                        
        `SELECT id, order_id, lat, lng, recorded_at                                                                                                                                       
         FROM order_tracking                                                                                                                                                               
         WHERE driver_id = $1                                                                                                                                                              
         ORDER BY recorded_at DESC LIMIT 5`,                                                                                                                                              
        [driverId]                                                                                                                                                                         
      );                                                                                                                                                                                   
      if (rows.length < 5) return null;                                                                                                                                                    
      const isStationary = rows.every((pt) => haversineDistance(pt.lat, pt.lng, currentLat, currentLng) < 0.05);                                                                           
      const oldestTime = new Date(rows[rows.length - 1].recorded_at).getTime();                                                                                                            
      const stopMinutes = Math.round((Date.now() - oldestTime) / (60 * 1000));                                                                                                             
                                                                                                                                                                                           
      if (isStationary && stopMinutes >= 20) {                                                                                                                                             
        const alertRes = await query(                                                                                                                                                      
          `INSERT INTO fleet_stop_alerts (truck_plate, driver_id, stop_lat, stop_lng, duration_minutes)                                                                                   
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,                                                                                                                                      
          [truckPlate, driverId, currentLat, currentLng, stopMinutes]                                                                                                                      
        );                                                                                                                                                                                 
        return alertRes.rows[0];                                                                                                                                                           
      }                                                                                                                                                                                    
      return null;                                                                                                                                                                         
    };                                                                                                                                                                                     
                                                                                                                                                                                           
    module.exports = { checkAbnormalStops };                                                                                                                                               
    