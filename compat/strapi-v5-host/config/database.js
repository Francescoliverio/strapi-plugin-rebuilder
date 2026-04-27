'use strict';

const path = require('path');

module.exports = ({ env }) => {
  const client = env('DATABASE_CLIENT', 'sqlite');

  if (client !== 'sqlite') {
    throw new Error(`Unsupported DATABASE_CLIENT for smoke host: ${client}`);
  }

  return {
    connection: {
      client: 'sqlite',
      connection: {
        filename: path.join(__dirname, '..', env('DATABASE_FILENAME', '.tmp/data.db')),
      },
      useNullAsDefault: true,
    },
  };
};
