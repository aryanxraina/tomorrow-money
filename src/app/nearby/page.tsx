'use client';

import { Banknote, Building2, MapPin, ShoppingBasket } from 'lucide-react';
import { Card, Muted, Row, SectionTitle, TopBar } from '@/components/ui';

export default function Nearby() {
  return (
    <div className="space-y-3">
      <TopBar title="Nearby" back="/more" />
      <Card>
        <SectionTitle>Find help near you</SectionTitle>
        <Muted className="mt-0.5">These open official finders, which ask for your postcode.</Muted>
        <div className="mt-1 divide-y divide-hair">
          <Row icon={<Banknote size={20} aria-hidden />} title="Free cash machines" sub="LINK cash machine finder" href="https://www.link.co.uk/consumers/locator/" external />
          <Row icon={<Building2 size={20} aria-hidden />} title="Free money advice" sub="Citizens Advice near you" href="https://www.citizensadvice.org.uk/about-us/contact-us/contact-us/contact-us/" external />
          <Row icon={<ShoppingBasket size={20} aria-hidden />} title="Food banks" sub="Trussell food bank finder" href="https://www.trussell.org.uk/emergency-food/find-a-food-bank" external />
          <Row icon={<MapPin size={20} aria-hidden />} title="Post Office branches" sub="Many offer free cash withdrawals" href="https://www.postoffice.co.uk/branch-finder" external />
        </div>
      </Card>
    </div>
  );
}
