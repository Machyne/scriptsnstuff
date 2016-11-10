(function() {
  const usage = "\n\nmongo --eval 'var run=1;[options]' workload.js\n" +
    "\nOptions:\n" +
    "    threads    default     8.  number of worker threads\n" +
    "    numOps     default: 1000.  number of total operations per thread\n" +
    "    docSize    default:  128.  size of the document to send\n" +
    "    batchSize  default:    1.  number of documents per batch\n" +
    "\nExample: mongo --eval 'var run=1, threads=8, numOps=10000, batchSize=1000' workload.js\n" +
    "\nNote: you must connect to a host while running this script.";

  if ((typeof db === 'undefined') || (run !== 1)) {
    print(usage);
    quit(1);
  }

  // Clean up input
  // ==============

  // Threads
  if (typeof threads === 'undefined') {
    threads = 8;
  } else if (typeof threads !== 'number') {
    threads = ~~threads;
  }
  threads = Math.max(threads, 1);
  // Num Ops
  if (typeof numOps === 'undefined') {
    numOps = 1000;
  } else if (typeof numOps !== 'number') {
    numOps = ~~numOps;
  }
  numOps = Math.max(numOps, 1);
  // Doc Size
  if (typeof docSize === 'undefined') {
    docSize = 128;
  } else if (typeof docSize !== 'number') {
    docSize = ~~docSize;
  }
  docSize = Math.max(docSize, 25);
  // Batch Size
  if (typeof batchSize === 'undefined') {
    batchSize = 1;
  } else if (typeof batchSize !== 'number') {
    batchSize = ~~batchSize;
  }
  batchSize = Math.max(batchSize, 1);

  // Set up workload
  // ===============

  db.getSiblingDB('workload').dropDatabase();

  const Thread = function() {
    this.init.apply(this, arguments);
  };
  _threadInject(Thread.prototype);

  // docs will look like: size, '\x07_id\0', oid, '\x02', 'a\0', str, '\0\0'
  // In bytes, 4 + 5 + 12 + 1 + 2 + x + 2 = docSize, so x = docSize - 24
  let str = '';
  const charSet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < (docSize - 24); i++) {
    str += charSet.charAt(~~(Math.random() * charSet.length));
  }

  const makeThread = function() {
    clearRawMongoProgramOutput();
    const batches = Math.floor(numOps / batchSize) + 1;
    const lastSize = numOps % batchSize;
    const doc = {
      a: str
    };
    const host = db.getMongo().host + '/workload';

    return new Thread(function(batches, batchSize, lastSize, doc, host) {
      const myDb = connect(host);
      while (batches--) {
        const size = (batches ? batchSize : lastSize);
        db.test.insert(Array(size).fill(doc));
      }
  }, batches, batchSize, lastSize, doc, host);
  };

  // Run the worker threads
  // ======================

  const threadArr = [];
  while (threadArr.push(makeThread()) < threads) {
    ; // pass
  }

  threadArr.forEach((t) => {
    t.start()
  });

  threadArr.forEach((t) => {
    t.join()
  });
})();
