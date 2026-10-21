const parseWhatsAppAudioOrder = (transcript) => {                                                                           
      const text = (transcript || '').toLowerCase();                                                                                                                                       
      let quantity_m3 = 10;                                                                                                                                                                
      if (text.includes('16') || text.includes('double')) quantity_m3 = 16;                                                                                                                
      if (text.includes('25') || text.includes('semi')) quantity_m3 = 25;                                                                                                                  
                                                                                                                                                                                           
      let material = 'Sable de rivière';                                                                                                                                                   
      if (text.includes('gravier') || text.includes('kpe')) material = 'Gravier concassé';                                                                                                 
      if (text.includes('latérite') || text.includes('rouge') || text.includes('vovo')) material = 'Latérite';                                                                             
                                                                                                                                                                                           
      return {                                                                                                                                                                             
        quantity_m3,                                                                                                                                                                       
        material,                                                                                                                                                                          
        confidence: 0.94,                                                                                                                                                                  
        ussd_payload: `*400*1*1#`,                                                                                                                                                       
      };                                                                                                                                                                                   
    };                                                                                                                                                                                     
                                                                                                                                                                                           
    module.exports = { parseWhatsAppAudioOrder };                                                                                                                                          
    