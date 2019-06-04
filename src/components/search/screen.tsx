import React from 'react';


export interface SearchScreenProps {
  visible: boolean
}


export class SearchScreen extends React.Component<SearchScreenProps> {
  state = {};
  binded = {};


  render() {
    const { visible } = this.props;

    return (
      <div style={{ display: visible ? 'block' : 'none' }}>
        search
      </div>
    );
  }
}


export default SearchScreen;
