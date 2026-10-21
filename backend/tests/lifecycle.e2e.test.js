const request = require('supertest');                                                                                                
    const { app } = require('../src/server');                                                                                                                                              
                                                                                                                                                                                           
    describe('Cycle de Vie BenneGo E2E', () => {                                                                                                                                           
      it('GET /health retourne le statut ok', async () => {                                                                                                                                
        const res = await request(app).get('/health');                                                                                                                                     
        expect(res.status).toBe(200);                                                                                                                                                      
        expect(res.body.status).toBe('ok');                                                                                                                                                
      });                                                                                                                                                                                  
                                                                                                                                                                                           
      it('Catalogue des engins exposé sur /api/vehicle-types', async () => {                                                                                                               
        const res = await request(app).get('/api/vehicle-types');                                                                                                                          
        expect([200, 401]).toContain(res.status);                                                                                                                                          
      });                                                                                                                                                                                  
    });                                                                                                                                                                                    
    