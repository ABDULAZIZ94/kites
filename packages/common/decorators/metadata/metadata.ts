import * as METADATA_KEY from '../../constants/metadata.keys';
import * as interfaces from '../../interfaces';

class Metadata implements interfaces.Metadata {

  public key: string | number | symbol;
  public value: any;

  public constructor(key: string | number | symbol, value: any) {
    this.key = key;
    this.value = value;
  }

  public toString() {
    if (this.key === METADATA_KEY.NAMED_TAG) {
      return `named: ${this.value.toString()} `;
    } else {
      return `tagged: { key:${this.key.toString()}, value: ${this.value} }`;
    }
  }
}

export { Metadata };
