// s2.2.7.5/6/7

const STATUS = {
  MORE: 0x0001,
  ERROR: 0x0002,
  // This bit is not yet in use by SQL Server, so is not exposed in the returned token
  INXACT: 0x0004,
  COUNT: 0x0010,
  ATTN: 0x0020,
  SRVERROR: 0x0100
};

function readUInt64LE(offset, noAssert) {
  const low = this.readUInt32LE(offset, noAssert);
  const high = this.readUInt32LE(offset + 4, noAssert);

  if (high) {
    return Math.pow(2, 32) * high + low
  } else {
    return low;
  }
}

function parseToken(parser, options, callback) {
  const length = 2 + 2 + (options.tdsVersion < "7_2" ? 4 : 8);
  const position = parser.position >>> 0;

  if (position + length <= parser.buffer.length) {
    const status = parser.buffer.readUInt16LE(position, true);
    const more = !!(status & STATUS.MORE);
    const sqlError = !!(status & STATUS.ERROR);
    const rowCountValid = !!(status & STATUS.COUNT);
    const attention = !!(status & STATUS.ATTN);
    const serverError = !!(status & STATUS.SRVERROR);
    const curCmd = parser.buffer.readUInt16LE(position + 2, true);
    const rowCount = (options.tdsVersion < "7_2" ? parser.buffer.readUInt32LE : readUInt64LE).call(parser.buffer, position + 4, true);

    parser.position = position + length;

    return callback({
      name: 'DONE',
      event: 'done',
      more: more,
      sqlError: sqlError,
      attention: attention,
      serverError: serverError,
      rowCount: rowCountValid ? rowCount : undefined,
      curCmd: curCmd
    });
  }

  parser.suspend(() => {
    parseToken(parser, options, callback);
  });
}

export function doneParser(parser, colMetadata, options, callback) {
  parseToken(parser, options, (token) => {
    token.name = 'DONE';
    token.event = 'done';
    callback(token);
  });
}

export function doneInProcParser(parser, colMetadata, options, callback) {
  parseToken(parser, options, (token) => {
    token.name = 'DONEINPROC';
    token.event = 'doneInProc';
    callback(token);
  });
}

export function doneProcParser(parser, colMetadata, options, callback) {
  parseToken(parser, options, (token) => {
    token.name = 'DONEPROC';
    token.event = 'doneProc';
    callback(token);
  });
}
