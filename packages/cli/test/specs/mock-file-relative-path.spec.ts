import { test } from '@oclif/test';
import axios from 'axios';
import { expect } from 'chai';

describe('Relative file path', () => {
  test
    .stdout()
    .command(['start', '--data', './test/data/envs/file.json'])
    .do(async () => {
      const rawResponse = { transformResponse: [(data) => data] };
      const result = await axios.get('http://localhost:3000/file');

      expect(result.data).to.contain('filecontent');

      // relative templated path staying within the environment directory
      const dynamicResult = await axios.get(
        'http://localhost:3000/param1/mock1.json',
        rawResponse
      );

      expect(dynamicResult.data).to.contain('"name": "mock1"');

      // relative templated path staying within its static base directory
      const staticBaseResult = await axios.get(
        'http://localhost:3000/param2/file1',
        rawResponse
      );

      expect(staticBaseResult.data).to.contain('filecontent');

      // partially templated file name (helper in the middle of the file name)
      const partialResult = await axios.get(
        'http://localhost:3000/testfile/1',
        rawResponse
      );

      expect(partialResult.data).to.contain('filecontent');
      expect(partialResult.data).to.not.contain('filecontent2');

      const partialResult2 = await axios.get(
        'http://localhost:3000/testfile/2',
        rawResponse
      );

      expect(partialResult2.data).to.contain('filecontent2');

      // path traversal through a templated file path must be blocked
      const traversalResult = await axios.get(
        'http://localhost:3000/param1/..%2Fbody-files%2Ffile1.txt',
        rawResponse
      );

      expect(traversalResult.data).to.contain(
        'Error while serving the content: Access to relative path outside of the allowed base directory'
      );
      expect(traversalResult.data).to.not.contain('filecontent');
    })
    .finally(() => {
      process.emit('SIGINT');
    })
    .it(
      'should start mock on port 3000 and call GET /file and get the file with a relative path from the environment file',
      (context) => {
        expect(context.stdout).to.contain('Server started');
      }
    );
});
