self.onmessage = (e) => {
  const { id, type, payload } = e.data;
  
  if (type === 'PROCESS_DATA') {
    // Simulate intensive task or process data
    const result = payload; 
    self.postMessage({ id, result });
  } else if (type === 'PROCESS_IMAGE') {
    // Example of using transferable objects
    const buffer = payload.buffer;
    // do something with buffer
    (self as any).postMessage({ id, result: buffer }, [buffer]);
  }
};
