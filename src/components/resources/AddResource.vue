<template>
  <div id="addResource">
    <label class="pageTitle">{{ title }}</label>
    <p class="instructions" >Add a link to a resource to be validated</p>
    <div class="vertical">
    <input id="resourceLink" placeholder="Resource Link" type="text" v-model=resource.uri data-vv-name="resourceUrl" data-vv-as="Resource Url" v-validate="'required'" :class="{ warningBorder: vErrors.has('resourceUrl') }"/>
    <p v-show="vErrors.has('resourceUrl')" class="warningText" >{{ vErrors.first('resourceUrl') }}</p>
    <select v-model="resource.profileId">
      <option disabled selected value="">[Choose Profile]</option>
      <option :value="profile.id" v-for="profile in profiles">{{ profile.name }}</option>
    </select>
    <input type="button" class="addButton" value="Validate" @click="addResource"/>
  </div>
  </div>
</template>

<script>
import { LOAD_PROFILES, STORE_DATA_RESOURCE } from '@/state/action-types';

export default {
  name: 'AddResource',
  data () {
    return {
      title: 'Add Data Resource',
      resource: {
        name: '',
        uri: '',
        profileId: null
      }
    };
  },
  methods: {
    addResource: function () {
      this.$validator.validateAll().then(() => {
        console.debug('Add Data Resource');
        this.$store.dispatch(STORE_DATA_RESOURCE, this.resource).then(() => {
          this.$router.push({name: 'resourceTable'});
        });
      }).catch((err) => {
        console.log(err);
      });
    }
  },
  computed: {
    profiles: function () {
      return this.$store.getters.profiles;
    }
  },
  mounted: function () {
    this.$store.dispatch(LOAD_PROFILES);
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style lang="scss" scoped>
@import '~@/assets/scss/application.scss';
.vertical {
   margin-top: 200px;
   width: 350px;
   display: flex;
   flex-direction: column;
   justify-content: center;
}
</style>
