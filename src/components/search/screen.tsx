import React from 'react';
import { PageHeader } from 'antd';
import SearchForm from './form';
import { SearchQuery } from './interfaces';


export interface SearchScreenProps {
  visible: boolean
}


export class SearchScreen extends React.Component<SearchScreenProps> {
  state = {

  };
  binded = {
    onSearch: this.onSearch.bind(this)
  };


  onSearch(query: SearchQuery) {
    console.log('onSearch', query);
  }


  render() {
    const { visible } = this.props;

    return (
      <div style={{ display: visible ? 'block' : 'none' }}>
        <PageHeader
          className="pageheader-with-button"
          backIcon={false}
          title="Search Traces"
        >
          <SearchForm onSearch={this.binded.onSearch} />
        </PageHeader>


        <div style={{ background: '#fff', margin: 24, padding: 10, borderRadius: 3 }}>
          Search result here
        </div>


      </div>
    );
  }
}


export default SearchScreen;
