import{e as i}from"./index-BzsAlLlJ.js";function n(){const{data:a=[]}=i({queryKey:["/api/users"]});return a.filter(e=>e&&e.id&&e.name).map(e=>({id:e.id,name:e.name,email:e.email}))}export{n as u};
