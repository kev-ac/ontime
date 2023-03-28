import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@chakra-ui/react';

import ModalWrapper from '../ModalWrapper';

import OscIntegration from './OscIntegration';
import OscSettings from './OscSettings';

import styles from '../Modal.module.scss';

interface IntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const oscDocsUrl = 'https://cpvalente.gitbook.io/ontime/control-and-feedback/osc';

export default function IntegrationModal(props: IntegrationModalProps) {
  const { isOpen, onClose } = props;

  return (
    <ModalWrapper title='Integration Settings' isOpen={isOpen} onClose={onClose}>
      <div className={styles.headerNotes}>
        Manage settings related to protocol integrations
        <a href={oscDocsUrl} target='_blank' rel='noreferrer'>
          Read the docs
        </a>
      </div>
      <Tabs variant='ontime' size='sm' isLazy>
        <TabList>
          <Tab>OSC</Tab>
          <Tab>OSC Integration</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <OscSettings />
          </TabPanel>
          <TabPanel>
            <OscIntegration />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </ModalWrapper>
  );
}