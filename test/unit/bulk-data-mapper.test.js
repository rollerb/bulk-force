const sinon = require('sinon');
const expect = require('chai').expect;
const chance = require('chance').Chance();
const proxyquire = require('proxyquire');

describe('bulk-data-mapper', () => {
    var sandbox = sinon.sandbox.create();

    beforeEach(() => {
        sandbox.restore();
    });

    describe('#map(mapFile, data)', () => {
        it('should map property names', () => {
            // given
            var mapFile = chance.word();
            var data = {
                foo: chance.word()
            };
            var expectedMappedData = {
                boo: data.foo
            };
            var propStub = sandbox.stub();
            var dataMapper = proxyquire('../../lib/bulk-data-mapper', {
                'properties-parser': {
                    read: propStub
                }
            });
            propStub.withArgs(mapFile).returns({foo: 'boo'});

            // when
            var mappedData = dataMapper.map(mapFile, [data]);

            // then
            expect(mappedData[0]).to.deep.equal(expectedMappedData);
        });

        it('should leave properties alone that are not mapped', () => {
            // given
            var mapFile = chance.word();
            var data = {
                foo: chance.word(),
                doh: chance.word()
            };
            var expectedMappedData = {
                boo: data.foo,
                doh: data.doh
            };
            var propStub = sandbox.stub();
            var dataMapper = proxyquire('../../lib/bulk-data-mapper', {
                'properties-parser': {
                    read: propStub
                }
            });
            propStub.withArgs(mapFile).returns({foo: 'boo'});

            // when
            var mappedData = dataMapper.map(mapFile, [data]);

            // then
            expect(mappedData[0]).to.deep.equal(expectedMappedData);
        });

        it('should use hardcoded value for property', () => {
            // given
            var mapFile = chance.word();
            var data = {};
            var expectedMappedData = {
                foo: 'boo'
            };
            var propStub = sandbox.stub();
            var dataMapper = proxyquire('../../lib/bulk-data-mapper', {
                'properties-parser': {
                    read: propStub
                }
            });
            propStub.withArgs(mapFile).returns({'[value]boo': 'foo'});

            // when
            var mappedData = dataMapper.map(mapFile, [data]);

            // then
            expect(mappedData[0]).to.deep.equal(expectedMappedData);
        });

        it('should use hardcoded value to override provided value for property', () => {
            // given
            var mapFile = chance.word();
            var data = {
                foo: chance.word()
            };
            var expectedMappedData = {
                foo: 'boo'
            };
            var propStub = sandbox.stub();
            var dataMapper = proxyquire('../../lib/bulk-data-mapper', {
                'properties-parser': {
                    read: propStub
                }
            });
            propStub.withArgs(mapFile).returns({'[value]boo': 'foo'});

            // when
            var mappedData = dataMapper.map(mapFile, [data]);

            // then
            expect(mappedData[0]).to.deep.equal(expectedMappedData);
        });      
    })
});