<template>
  <div id="profileTable">
    <b-row no-gutters>
      <b-col order='2' cols='12' sm='3'>
        <b-button id="addNewProfileButton" size="md" class="addButton" @click="addProfile">
          <label>Add new Data Profile</label>
          <img src="~@/assets/images/white-plus-icon.svg" />
        </b-button>
      </b-col>
      <b-col order='1' cols='12' sm='9'>
        <label class="pageTitle">{{ title }}</label>
        <p class="instructions">
          A List of Data Profiles associated with this account. You can add more data profiles by clicking the "Add New Data Profile" button.
        </p>
      </b-col>
    </b-row>
    <b-row>
      <b-col>
        <b-form-select id="nameFilter" class="custom-select" v-model="selectedName" :options="nameList">
          <option value="" id='nameFilterHeader'>Filter by Group</option>
        </b-form-select>
      </b-col>
    </b-row>
    <b-row v-if="profiles.length == 0">
      <b-col offset="4" cols="4">
        <p id="noProfilesAvailable"  class="warningText"> No Profiles available for this account</p>
      </b-col>
    </b-row>
    <div v-else>
    <profile-row :key="profile.id"  v-for="profile in filteredProfiles" :profile="profile"></profile-row>
    </div>
  </div>
</template>

<script>
import ProfileRow from './ProfileRow.vue';
import { LOAD_PROFILES } from '@/state/action-types';
import { getUniqueListOfValues } from '@/components/common/dropdown.js';
export default {
  name: 'Profiles',
  data () {
    return {
      title: 'Data Profiles',
      accountId: 0,
      selectedName: ''
    };
  },
  methods: {
    addProfile: function () {
      this.$router.push({ name: 'addProfile', params: {actionType: 'Add'} });
    }
  },
  computed: {
    profiles: function () {
      return this.$store.getters.profiles;
    },
    nameList: function () {
      return getUniqueListOfValues(this.profiles, 'name');
    },
    filteredProfiles: function () {
      var result = this.profiles;
      if (this.selectedName !== '') {
        result = result.filter((profile) => {
          return profile.name === this.selectedName;
        });
      }
      console.debug('filteredProfiles:', result);
      return result;
    }
  },
  components: {
    ProfileRow: ProfileRow
  },
  mounted: function () {
    this.$store.dispatch(LOAD_PROFILES);
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss" scoped>
@import '~@/assets/scss/application.scss';

.headerContainer {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
}

.flexContainer {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
}

.flexHeading {
  min-width: 120px;
  display: inline-block;
}

.tableSeparator {
  border-bottom: 2px solid black;
  padding-bottom: 15px;
}

.custom-select{
  margin-top: 5px;
}
.fade-enter-active, .fade-leave-active {
  transition: opacity .5s
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
  opacity: 0
}

.component-fade-enter-active, .component-fade-leave-active {
  transition: opacity .3s ease;
}
.component-fade-enter, .component-fade-leave-to
/* .component-fade-leave-active below version 2.1.8 */ {
  opacity: 0;
}
</style>
