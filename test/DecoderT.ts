import * as assert from 'assert'
import * as E from 'fp-ts/lib/Either'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import { pipe } from 'fp-ts/lib/pipeable'
import * as T from 'fp-ts/lib/Tree'
import * as DT from '../src/DecoderT'
import * as G from '../src/Guard'

const M = E.getValidation(NEA.getSemigroup<T.Tree<string>>())

function fromGuard<A>(guard: G.Guard<A>, expected: string): DT.DecoderT<E.URI, NEA.NonEmptyArray<T.Tree<string>>, A> {
  return {
    decode: (u) =>
      guard.is(u) ? E.right(u) : E.left([T.make(`cannot decode ${JSON.stringify(u)}, should be ${expected}`)])
  }
}

const UnknownArray = fromGuard(G.UnknownArray, 'Array<unknown>')
const UnknownRecord = fromGuard(G.UnknownRecord, 'Record<string, unknown>')
const string = fromGuard(G.string, 'string')
const number = fromGuard(G.number, 'number')

describe('DecoderT', () => {
  it('array', () => {
    const array = DT.array(M)(UnknownArray, (i, e) =>
      pipe(
        e,
        NEA.map((e) => T.make(`item ${i}`, [e]))
      )
    )
    const decoder = array(string)
    assert.deepStrictEqual(decoder.decode(['a', 'b']), E.right(['a', 'b']))
    assert.deepStrictEqual(decoder.decode(null), E.left([T.make('cannot decode null, should be Array<unknown>')]))
    assert.deepStrictEqual(
      decoder.decode([1, 2]),
      E.left([
        T.make('item 0', [T.make('cannot decode 1, should be string')]),
        T.make('item 1', [T.make('cannot decode 2, should be string')])
      ])
    )
  })

  it('record', () => {
    const record = DT.record(M)(UnknownRecord, (k, e) =>
      pipe(
        e,
        NEA.map((e) => T.make(`key ${JSON.stringify(k)}`, [e]))
      )
    )
    const decoder = record(string)
    assert.deepStrictEqual(decoder.decode({}), E.right({}))
    assert.deepStrictEqual(decoder.decode({ a: 'a' }), E.right({ a: 'a' }))
    assert.deepStrictEqual(
      decoder.decode(null),
      E.left([T.make('cannot decode null, should be Record<string, unknown>')])
    )
    assert.deepStrictEqual(
      decoder.decode({ a: 1, b: 2 }),
      E.left([
        T.make('key "a"', [T.make('cannot decode 1, should be string')]),
        T.make('key "b"', [T.make('cannot decode 2, should be string')])
      ])
    )
  })

  it('type', () => {
    const type = DT.type(M)(UnknownRecord, (k, e) =>
      pipe(
        e,
        NEA.map((e) => T.make(`required property ${JSON.stringify(k)}`, [e]))
      )
    )
    const decoder = type({
      name: string,
      age: number
    })
    assert.deepStrictEqual(decoder.decode({ name: 'name', age: 18 }), E.right({ name: 'name', age: 18 }))
    assert.deepStrictEqual(
      decoder.decode(null),
      E.left([T.make('cannot decode null, should be Record<string, unknown>')])
    )
    assert.deepStrictEqual(
      decoder.decode({}),
      E.left([
        T.make('required property "name"', [T.make('cannot decode undefined, should be string')]),
        T.make('required property "age"', [T.make('cannot decode undefined, should be number')])
      ])
    )
  })

  it('partial', () => {
    const partial = DT.partial(M)(UnknownRecord, (k, e) =>
      pipe(
        e,
        NEA.map((e) => T.make(`optional property ${JSON.stringify(k)}`, [e]))
      )
    )
    const decoder = partial({
      name: string,
      age: number
    })
    assert.deepStrictEqual(decoder.decode({ name: 'name', age: 18 }), E.right({ name: 'name', age: 18 }))
    assert.deepStrictEqual(decoder.decode({}), E.right({}))
    assert.deepStrictEqual(
      decoder.decode(null),
      E.left([T.make('cannot decode null, should be Record<string, unknown>')])
    )
    assert.deepStrictEqual(
      decoder.decode({ name: 1, age: 'a' }),
      E.left([
        T.make('optional property "name"', [T.make('cannot decode 1, should be string')]),
        T.make('optional property "age"', [T.make('cannot decode "a", should be number')])
      ])
    )
  })
})