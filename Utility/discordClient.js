let client = null;

const setClient = (c) => { client = c; };
const getClient = () => client;

module.exports = { setClient, getClient };
