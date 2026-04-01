const log = (category, message) => {
    console.log(`[${category}] ${message}`);
};

const error = (category, message) => {
    console.error(`[${category}] ${message}`);
};

module.exports = { log, error };
