const { loadEntries, removeEntry } = require('../Utility/cronStore');

const handler = async ({ id }) => {
    if (typeof id !== 'string' || !id.trim()) {
        return 'Error: id is required.';
    }

    const entries = loadEntries();
    const existing = entries.find(e => e.id === id);
    if (!existing) {
        return `Error: no cron entry with id "${id}". Use list_crons to see available ids.`;
    }

    removeEntry(id);
    return `Deleted cron "${id}" (${existing.type} "${existing.schedule}" → channel ${existing.channelId}).`;
};

const declaration = {
    type: "function",
    function: {
        name: "delete_cron",
        description: "Deletes a scheduled cron entry by its id. Use list_crons first if you're not sure of the id. Deletion is permanent — confirm with the user before deleting unless they explicitly asked you to remove it.",
        parameters: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    description: "The cron entry id (e.g. 'cron_1712923200000'). Get it from list_crons."
                }
            },
            required: ["id"]
        }
    }
};

module.exports = { handler, declaration };
