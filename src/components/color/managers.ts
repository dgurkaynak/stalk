import MPN65ColorAssigner from './assigners/mpn65';

const traceName = new MPN65ColorAssigner();
const operationName = new MPN65ColorAssigner();
const serviceName = new MPN65ColorAssigner();

export default {
  traceName,
  operationName,
  serviceName
};
